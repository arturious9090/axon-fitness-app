import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { Resend } from "resend";
import { APIError } from "better-auth/api";
import type { Pool } from "pg";
import { transaction } from "./db";
import type { config } from "./config";
export type Mail = { to: string; subject: string; text: string };
export function createMailer(pool: Pool, settings: ReturnType<typeof config>) {
  const key = createHash("sha256").update(settings.secret).digest();
  function encrypt(mail: Mail) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", key, iv);
    const body = Buffer.concat([
      cipher.update(JSON.stringify(mail), "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
  }
  function decrypt(payload: string): Mail {
    const value = Buffer.from(payload, "base64"),
      cipher = createDecipheriv("aes-256-gcm", key, value.subarray(0, 12));
    cipher.setAuthTag(value.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        cipher.update(value.subarray(28)),
        cipher.final(),
      ]).toString(),
    );
  }
  async function enqueue(
    userId: string,
    purpose: "verify" | "reset",
    mail: Mail,
  ) {
    return transaction(pool, async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('axon-email-quota'))",
      );
      const counts = await client.query(
        "SELECT count(*) FILTER(WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS day, count(*) FILTER(WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS month FROM email_jobs",
      );
      const reserve = purpose === "verify" ? 10 : 0;
      if (
        counts.rows[0].day >= settings.dailyLimit - reserve ||
        counts.rows[0].month >= settings.monthlyLimit - reserve
      )
        throw new APIError("TOO_MANY_REQUESTS", {
          message: "Email quota reached. Try again later.",
          code: "EMAIL_QUOTA",
        });
      const recent = await client.query(
        "SELECT id FROM email_jobs WHERE user_id=$1 AND created_at > now()-interval '60 seconds' LIMIT 1",
        [userId],
      );
      if (recent.rowCount)
        throw new APIError("TOO_MANY_REQUESTS", {
          message: "Wait before requesting another email.",
          code: "EMAIL_COOLDOWN",
        });
      const id = randomUUID();
      await client.query(
        "INSERT INTO email_jobs(id,user_id,purpose,payload,expires_at,status) VALUES($1,$2,$3,$4,now()+interval '25 minutes',$5)",
        [
          id,
          userId,
          purpose,
          encrypt(mail),
          settings.provider === "test" ? "test" : "pending",
        ],
      );
      return id;
    });
  }
  let working = false;
  async function tick() {
    if (working || settings.provider === "test") return;
    working = true;
    try {
      // Reclaim a crashed worker with the same idempotency key, within the provider's 24h window.
      const job = await transaction(pool, async (client) => {
        await client.query(
          "UPDATE email_jobs SET status='failed',payload=NULL WHERE status IN ('pending','sending') AND expires_at<=now()",
        );
        const result = await client.query(
          "SELECT * FROM email_jobs WHERE expires_at>now() AND ((status='pending' AND available_at<=now()) OR (status='sending' AND available_at<now()-interval '2 minutes')) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
        );
        if (!result.rowCount) return null;
        const row = result.rows[0];
        await client.query(
          "UPDATE email_jobs SET status='sending',attempts=attempts+1,available_at=now() WHERE id=$1",
          [row.id],
        );
        return row;
      });
      if (!job) return;
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send(
        { from: process.env.EMAIL_FROM!, ...decrypt(job.payload) },
        { idempotencyKey: `axon-${job.id}` },
      );
      if (result.error)
        throw new Error(`Resend send failed: ${result.error.name}`);
      await pool.query(
        "UPDATE email_jobs SET status='sent',payload=NULL,provider_id=$2 WHERE id=$1",
        [job.id, result.data!.id],
      );
    } finally {
      working = false;
    }
  }
  async function retryFailedAttempt() {
    await pool.query(
      "UPDATE email_jobs SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,available_at=now()+interval '60 seconds' * power(2,least(attempts,5)) WHERE status='sending' AND available_at<now()-interval '2 minutes'",
    );
  }
  async function testInbox() {
    const r = await pool.query(
      "SELECT id,payload,created_at FROM email_jobs WHERE status='test' ORDER BY created_at DESC LIMIT 50",
    );
    return r.rows.map((j) => ({
      id: j.id,
      createdAt: j.created_at,
      ...decrypt(j.payload),
    }));
  }
  return { enqueue, tick, retryFailedAttempt, testInbox };
}
