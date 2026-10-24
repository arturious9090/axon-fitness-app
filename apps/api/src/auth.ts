import { betterAuth } from "better-auth";
import { queueAfterTransactionHook } from "@better-auth/core/context";
import { expo } from "@better-auth/expo";
import { randomBytes, createHash } from "node:crypto";
import type { Pool } from "pg";
import type { config } from "./config";
import type { createMailer } from "./mail";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function createAuth(
  pool: Pool,
  settings: ReturnType<typeof config>,
  mailer: ReturnType<typeof createMailer>,
) {
  function language(request?: Request) {
    return request?.headers.get("x-axon-language") === "en" ? "en" : "ru";
  }
  return betterAuth({
    appName: "Axon Fitness",
    baseURL: settings.authURL,
    secret: settings.secret,
    database: pool,
    trustedOrigins: [
      settings.appURL,
      "axonfitness://",
      ...(!settings.production ? ["exp://"] : []),
    ],
    plugins: [expo()],
    advanced: { useSecureCookies: settings.production },
    verification: { storeIdentifier: "hashed" },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 1800,
      sendResetPassword: async ({ user, url }, request) => {
        const link = new URL(url);
        link.searchParams.set(
          "callbackURL",
          `${settings.appURL}/reset-password`,
        );
        const en = language(request) === "en";
        await mailer.enqueue(user.id, "reset", {
          to: user.email,
          subject: en ? "Reset your Axon password" : "Сброс пароля Axon",
          text: `${en ? "Reset your password within 30 minutes:" : "Смените пароль в течение 30 минут:"}\n${link.toString()}\n\n${en ? "If you did not request this, ignore this email." : "Если вы не запрашивали смену пароля, проигнорируйте письмо."}`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: 1800,
      sendVerificationEmail: async ({ user }, request) => {
        await queueAfterTransactionHook(async () => {
          const token = randomBytes(32).toString("base64url");
          await pool.query(
            "INSERT INTO email_verifications(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')",
            [hashToken(token), user.id],
          );
          const en = language(request) === "en";
          await mailer.enqueue(user.id, "verify", {
            to: user.email,
            subject: en ? "Confirm your Axon email" : "Подтвердите почту Axon",
            text: `${en ? "Confirm your email within 30 minutes:" : "Подтвердите почту в течение 30 минут:"}\n${settings.authURL}/api/account/verify?token=${token}\n\n${en ? "If you did not create an account, ignore this email." : "Если вы не создавали аккаунт, проигнорируйте письмо."}`,
          });
        });
      },
    },
    user: { deleteUser: { enabled: true } },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
      storage: "database",
      customRules: {
        "/sign-up/email": { window: 60, max: 3 },
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
      },
    },
  });
}
