import { createApp } from "./app";
const { app, mailer } = await createApp();
await app.listen({
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
});
const worker = setInterval(() => void mailer.tick().catch(() => {}), 5000);
const retries = setInterval(
  () => void mailer.retryFailedAttempt().catch(() => {}),
  60000,
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    clearInterval(worker);
    clearInterval(retries);
    await app.close();
    process.exit(0);
  });
