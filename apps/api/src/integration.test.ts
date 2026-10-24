import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { defaultSettings, makeWorkout, type Operation } from "@axon/core";
import { createApp } from "./app";
import { migrate } from "./migrate";
import type { config } from "./config";

const adminURL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://axon:axon_local_only@localhost:56437/axon";
if (!["localhost", "127.0.0.1"].includes(new URL(adminURL).hostname))
  throw new Error(
    "Integration tests require a dedicated local PostgreSQL server.",
  );
const admin = new Pool({ connectionString: adminURL }),
  database = `axon_test_${randomBytes(6).toString("hex")}`;
const databaseURL = new URL(adminURL);
databaseURL.pathname = `/${database}`;
let runtime: Awaited<ReturnType<typeof createApp>>;
const base: ReturnType<typeof config> = {
  secret: randomBytes(48).toString("hex"),
  production: false,
  provider: "test",
  appURL: "http://localhost:8081",
  authURL: "http://localhost:3000",
  databaseURL: databaseURL.toString(),
  dailyLimit: 90,
  monthlyLimit: 2900,
};
const password = "Correct-horse-strength-73";
let nextAddress = 2;
type Actor = { id: string; cookie: string; email: string; address: string };
function cookieOf(headers: Record<string, unknown>) {
  const value = headers["set-cookie"];
  return (Array.isArray(value) ? value : [value])
    .filter(Boolean)
    .map((v) => String(v).split(";")[0])
    .join("; ");
}
async function request(url: string, payload?: unknown, actor?: Partial<Actor>) {
  return runtime.app.inject({
    method: payload === undefined ? "GET" : "POST",
    url,
    remoteAddress: actor?.address ?? "127.0.0.1",
    headers: {
      "content-type": "application/json",
      origin: base.appURL,
      ...(actor?.cookie ? { cookie: actor.cookie } : {}),
    },
    ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}),
  });
}
async function signup(): Promise<Actor> {
  const actor = {
    id: "",
    cookie: "",
    email: `${randomUUID()}@example.test`,
    address: `127.0.0.${nextAddress++}`,
  };
  const r = await request(
    "/api/auth/sign-up/email",
    { email: actor.email, password, name: "Test member" },
    actor,
  );
  expect(r.statusCode, r.body).toBe(200);
  return { ...actor, id: r.json().user.id };
}
async function verify(actor: Actor) {
  const mail = (await runtime.mailer.testInbox()).find(
    (m) => m.to === actor.email,
  )!;
  expect(mail).toBeDefined();
  const link = new URL(mail.text.match(/http[^\s]+/)![0]);
  return request(link.pathname + link.search, undefined, actor);
}
async function login(actor: Actor, pw = password) {
  const result = await request(
    "/api/auth/sign-in/email",
    { email: actor.email, password: pw },
    actor,
  );
  if (result.statusCode === 200) actor.cookie = cookieOf(result.headers);
  return result;
}
async function member() {
  const a = await signup();
  expect((await verify(a)).statusCode).toBe(302);
  expect((await login(a)).statusCode).toBe(200);
  return a;
}
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${database}`);
  runtime = await createApp(base);
  await migrate(runtime.pool, runtime.auth);
  await runtime.app.ready();
});
afterAll(async () => {
  if (runtime) await runtime.app.close();
  await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
  await admin.end();
});

describe("real PostgreSQL accounts and sync", () => {
  it("requires email verification; confirmation links are single-use and only hashed in storage", async () => {
    const actor = await signup();
    expect((await login(actor)).statusCode).toBe(403);
    expect((await verify(actor)).headers.location).toContain("verified=1");
    expect((await verify(actor)).headers.location).toContain("invalid_token");
    expect((await login(actor)).statusCode).toBe(200);
    const stored = await runtime.pool.query(
      "SELECT token_hash FROM email_verifications WHERE user_id=$1",
      [actor.id],
    );
    expect(stored.rows[0].token_hash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("rejects anonymous writes and an untrusted web origin", async () => {
    expect((await request("/api/sync/push", {})).statusCode).toBe(401);
    const a = await member();
    const r = await runtime.app.inject({
      method: "POST",
      url: "/api/sync/push",
      headers: { origin: "https://other.example", cookie: a.cookie },
      payload: {},
    });
    expect(r.statusCode).toBe(403);
  });
  it("retries a lost-response operation exactly once, and isolates two users with the same entity ID", async () => {
    const a = await member(),
      b = await member(),
      workout = makeWorkout("Offline session", ["bench"], randomUUID);
    const op: Operation = {
      operationId: randomUUID(),
      kind: "workout",
      entityId: workout.id,
      baseVersion: 0,
      data: workout,
    };
    const first = await request("/api/sync/push", op, a),
      retry = await request("/api/sync/push", op, a);
    expect(first.statusCode, first.body).toBe(200);
    expect(retry.json()).toEqual(first.json());
    const pullA = (
      await request("/api/sync/pull?cursor=0", undefined, a)
    ).json();
    expect(pullA.changes).toHaveLength(1);
    expect(
      (await request("/api/sync/pull?cursor=0", undefined, b)).json().changes,
    ).toHaveLength(0);
    const other = await request(
      "/api/sync/push",
      {
        ...op,
        operationId: randomUUID(),
        data: { ...workout, name: "Other user" },
      },
      b,
    );
    expect(other.json().status).toBe("accepted");
    expect(
      (await request("/api/sync/pull?cursor=0", undefined, a)).json().changes[0]
        .data.name,
    ).toBe("Offline session");
    expect(
      (
        await request(
          "/api/sync/push",
          { ...op, data: { ...workout, name: "reused receipt" } },
          a,
        )
      ).statusCode,
    ).toBe(400);
  });
  it("detects stale devices and synchronizes deletions using increasing server cursors", async () => {
    const actor = await member(),
      settings = defaultSettings();
    const makeOp = (version: number, data: unknown) => ({
      operationId: randomUUID(),
      kind: "settings",
      entityId: "settings",
      baseVersion: version,
      data,
    });
    const first = (
      await request("/api/sync/push", makeOp(0, settings), actor)
    ).json();
    const second = (
      await request(
        "/api/sync/push",
        makeOp(1, { ...settings, name: "Device A" }),
        actor,
      )
    ).json();
    const stale = (
      await request(
        "/api/sync/push",
        makeOp(1, { ...settings, name: "Device B" }),
        actor,
      )
    ).json();
    expect(stale.status).toBe("conflict");
    expect(stale.record.data.name).toBe("Device A");
    expect(second.record.sequence).toBeGreaterThan(first.record.sequence);
    const workout = makeWorkout("To delete", [], randomUUID);
    const op = {
      operationId: randomUUID(),
      kind: "workout",
      entityId: workout.id,
      baseVersion: 0,
      data: workout,
    };
    const created = (await request("/api/sync/push", op, actor)).json();
    const deleted = (
      await request(
        "/api/sync/push",
        { ...op, operationId: randomUUID(), baseVersion: 1, data: null },
        actor,
      )
    ).json();
    expect(deleted.record.data).toBeNull();
    const pulled = (
      await request(
        `/api/sync/pull?cursor=${created.record.sequence}`,
        undefined,
        actor,
      )
    ).json();
    expect(pulled.changes[0].data).toBeNull();
  });
  it("validates entities and rejects negative cursors", async () => {
    const a = await member();
    expect(
      (await request("/api/sync/pull?cursor=-1", undefined, a)).statusCode,
    ).toBe(400);
    const id = randomUUID();
    expect(
      (
        await request(
          "/api/sync/push",
          {
            operationId: randomUUID(),
            kind: "workout",
            entityId: id,
            baseVersion: 0,
            data: { id },
          },
          a,
        )
      ).statusCode,
    ).toBe(400);
  });
  it("serializes concurrent writes to the same version without losing the conflict", async () => {
    const a = await member();
    const ops = ["A", "B"].map((name) => ({
      operationId: randomUUID(),
      kind: "settings",
      entityId: "settings",
      baseVersion: 0,
      data: { ...defaultSettings(), name },
    }));
    const results = await Promise.all(
      ops.map((op) => request("/api/sync/push", op, a)),
    );
    expect(results.map((r) => r.json().status).sort()).toEqual([
      "accepted",
      "conflict",
    ]);
  });
  it("resets a password once, revokes old sessions, and does not expose unknown email addresses", async () => {
    const actor = await member();
    await runtime.pool.query(
      "UPDATE email_jobs SET created_at=now()-interval '2 minutes' WHERE user_id=$1",
      [actor.id],
    );
    const reset = await request(
      "/api/auth/request-password-reset",
      { email: actor.email, redirectTo: `${base.appURL}/reset-password` },
      actor,
    );
    const absent = await request(
      "/api/auth/request-password-reset",
      {
        email: "unknown@example.test",
        redirectTo: `${base.appURL}/reset-password`,
      },
      actor,
    );
    expect(reset.statusCode, reset.body).toBe(200);
    expect(absent.json()).toEqual(reset.json());
    const mail = (await runtime.mailer.testInbox()).find(
      (m) => m.to === actor.email && m.subject.includes("пароля"),
    )!;
    expect(mail).toBeDefined();
    const link = new URL(mail.text.match(/http[^\s]+/)![0]);
    const token = link.pathname.split("/").at(-1)!;
    const newPassword = password + "-new";
    const result = await request(
      "/api/auth/reset-password",
      { token, newPassword },
      actor,
    );
    expect(result.statusCode, result.body).toBe(200);
    expect(
      (await request("/api/sync/pull?cursor=0", undefined, actor)).statusCode,
    ).toBe(401);
    expect(
      (await request("/api/auth/reset-password", { token, newPassword }, actor))
        .statusCode,
    ).toBe(400);
    expect((await login(actor, newPassword)).statusCode).toBe(200);
  });
  it("reserves email capacity for password recovery and encrypts queued content", async () => {
    const a = await member();
    await runtime.pool.query(
      "UPDATE email_jobs SET created_at=now()-interval '2 minutes' WHERE user_id=$1",
      [a.id],
    );
    const payload = await runtime.pool.query(
      "SELECT payload FROM email_jobs WHERE user_id=$1",
      [a.id],
    );
    expect(payload.rows[0].payload).not.toContain("http");
    expect(payload.rows[0].payload).not.toContain(a.email);
    const old = (
      await runtime.pool.query("SELECT count(*)::int AS n FROM email_jobs")
    ).rows[0].n;
    const limited = { ...base, dailyLimit: old + 10, monthlyLimit: 2900 };
    const { createMailer } = await import("./mail");
    const mailer = createMailer(runtime.pool, limited);
    await expect(
      mailer.enqueue(a.id, "verify", {
        to: a.email,
        subject: "test",
        text: "test",
      }),
    ).rejects.toThrow("quota");
    await expect(
      mailer.enqueue(a.id, "reset", {
        to: a.email,
        subject: "test",
        text: "test",
      }),
    ).resolves.toBeDefined();
  });
  it("deleting an account cascades its records and receipts", async () => {
    const a = await member();
    await request(
      "/api/sync/push",
      {
        operationId: randomUUID(),
        kind: "settings",
        entityId: "settings",
        baseVersion: 0,
        data: defaultSettings(),
      },
      a,
    );
    const result = await request("/api/auth/delete-user", { password }, a);
    expect(result.statusCode, result.body).toBe(200);
    for (const table of [
      "fitness_records",
      "sync_receipts",
      "email_jobs",
      "email_verifications",
    ])
      expect(
        (
          await runtime.pool.query(
            `SELECT count(*)::int AS n FROM ${table} WHERE user_id=$1`,
            [a.id],
          )
        ).rows[0].n,
      ).toBe(0);
  });
});
