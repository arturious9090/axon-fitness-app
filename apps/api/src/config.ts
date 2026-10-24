export function config() {
  const production = process.env.NODE_ENV === "production";
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("replace-"))
    throw new Error(
      "Set BETTER_AUTH_SECRET to a unique secret of at least 32 characters.",
    );
  const appURL = process.env.PUBLIC_APP_URL ?? "http://localhost:8081",
    authURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const provider = process.env.EMAIL_PROVIDER ?? "test";
  if (!["test", "resend"].includes(provider))
    throw new Error("EMAIL_PROVIDER must be test or resend");
  if (
    production &&
    (!appURL.startsWith("https://") ||
      !authURL.startsWith("https://") ||
      provider !== "resend")
  )
    throw new Error("Production requires HTTPS URLs and Resend.");
  if (
    provider === "resend" &&
    (!process.env.RESEND_API_KEY ||
      !process.env.EMAIL_FROM ||
      process.env.EMAIL_FROM.includes("example.com"))
  )
    throw new Error("Configure Resend key and verified EMAIL_FROM.");
  return {
    secret,
    production,
    appURL,
    authURL,
    provider,
    databaseURL:
      process.env.DATABASE_URL ??
      "postgresql://axon:axon_local_only@localhost:56437/axon",
    dailyLimit: Number(process.env.EMAIL_DAILY_LIMIT ?? 90),
    monthlyLimit: Number(process.env.EMAIL_MONTHLY_LIMIT ?? 2900),
  };
}
