import * as SQLite from "expo-sqlite";
let database: Promise<SQLite.SQLiteDatabase> | undefined;
let pending: Promise<unknown> = Promise.resolve();
function open() {
  return (database ??= (async () => {
    const db = await SQLite.openDatabaseAsync("axon-fitness.db");
    await db.execAsync(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)",
    );
    return db;
  })());
}
export async function read<T>(key: string): Promise<T | null> {
  const db = await open();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM documents WHERE key=?",
    key,
  );
  return row ? JSON.parse(row.value) : null;
}
export function transact<T>(
  key: string,
  change: (previous: T | null) => T,
): Promise<T> {
  const task = pending.then(async () => {
    const db = await open();
    let next: T;
    await db.withExclusiveTransactionAsync(async (tx) => {
      const row = await tx.getFirstAsync<{ value: string }>(
        "SELECT value FROM documents WHERE key=?",
        key,
      );
      next = change(row ? JSON.parse(row.value) : null);
      await tx.runAsync(
        "INSERT INTO documents (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        key,
        JSON.stringify(next),
      );
    });
    return next!;
  });
  pending = task.catch(() => {});
  return task;
}
export async function requestPersistence() {}
