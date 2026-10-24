import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { fromNodeHeaders } from "better-auth/node";
import { config } from "./config";
import { createPool, transaction } from "./db";
import { createMailer } from "./mail";
import { createAuth, hashToken } from "./auth";
import { createSync, SyncValidationError } from "./sync";
export async function createApp(settings = config()) {
  const pool = createPool(settings.databaseURL),
    mailer = createMailer(pool, settings),
    auth = createAuth(pool, settings, mailer),
    sync = createSync(pool);
  const app = Fastify({
    bodyLimit: 1024 * 1024,
    logger: settings.production
      ? {
          redact: ["req.headers.cookie", "req.headers.authorization"],
          serializers: {
            req: (r) => ({
              method: r.method,
              url: r.url.split("?")[0],
              remoteAddress: r.ip,
            }),
          },
        }
      : false,
    trustProxy: settings.production
      ? (_address: string, hop: number) => hop < 1
      : false,
  });
  await app.register(cors, {
    origin: settings.appURL,
    credentials: true,
    allowedHeaders: ["Content-Type", "x-axon-language"],
    methods: ["GET", "POST", "OPTIONS"],
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.addHook("onRequest", async (request, reply) => {
    // Protect cookie-authenticated custom mutations too, not only Better Auth routes.
    if (request.method === "POST" && request.url.startsWith("/api/sync/")) {
      const origin = request.headers.origin;
      if (origin && origin !== new URL(settings.appURL).origin)
        return reply.code(403).send({ error: "UNTRUSTED_ORIGIN" });
      if (!origin && request.headers["sec-fetch-site"] === "cross-site")
        return reply.code(403).send({ error: "UNTRUSTED_ORIGIN" });
    }
  });
  app.get("/api/health", async () => {
    await pool.query("SELECT 1");
    return { status: "ok" };
  });
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    handler: async (request, reply) => {
      const url = new URL(request.url, settings.authURL),
        headers = fromNodeHeaders(request.headers);
      headers.set("x-forwarded-for", request.ip);
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers,
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        }),
      );
      reply.code(response.status);
      response.headers.forEach((value, key) => {
        if (key !== "set-cookie") reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) reply.header("set-cookie", cookies);
      return reply.send(response.body ? await response.text() : null);
    },
  });
  app.get<{ Querystring: { token?: string } }>(
    "/api/account/verify",
    async (request, reply) => {
      const token = request.query.token;
      if (!token || token.length > 200)
        return reply.code(400).send({ error: "INVALID_TOKEN" });
      const ok = await transaction(pool, async (client) => {
        const result = await client.query(
          "UPDATE email_verifications SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING user_id",
          [hashToken(token)],
        );
        if (!result.rowCount) return false;
        await client.query(
          'UPDATE "user" SET "emailVerified"=true,"updatedAt"=now() WHERE id=$1',
          [result.rows[0].user_id],
        );
        return true;
      });
      return reply.redirect(
        `${settings.appURL}/account?${ok ? "verified=1" : "error=invalid_token"}`,
      );
    },
  );
  app.post("/api/sync/push", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session?.user.emailVerified)
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    return sync.push(session.user.id, request.body);
  });
  app.get<{ Querystring: { cursor?: string } }>(
    "/api/sync/pull",
    async (request, reply) => {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });
      if (!session?.user.emailVerified)
        return reply.code(401).send({ error: "UNAUTHORIZED" });
      return sync.pull(session.user.id, Number(request.query.cursor ?? 0));
    },
  );
  if (!settings.production && settings.provider === "test")
    app.get("/api/dev/mail", async (request, reply) => {
      if (!["127.0.0.1", "::1"].includes(request.ip))
        return reply.code(403).send({ error: "LOCAL_ONLY" });
      return mailer.testInbox();
    });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof SyncValidationError)
      return reply.code(400).send({ error: "INVALID_OPERATION" });
    if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode < 500
    )
      return reply.code(error.statusCode).send({ error: "REQUEST_REJECTED" });
    app.log.error(
      { name: error instanceof Error ? error.name : "UnknownError" },
      "Request failed",
    );
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  });
  app.addHook("onClose", async () => {
    await pool.end();
  });
  return { app, pool, auth, mailer, sync };
}
