import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  entitySchemas,
  exercises,
  operationSchema,
  type RecordEnvelope,
  type PushResult,
} from "@axon/core";
import { transaction } from "./db";
export class SyncValidationError extends Error {}
function envelope(row: Record<string, any>): RecordEnvelope {
  return {
    kind: row.kind,
    entityId: row.entity_id,
    version: row.version,
    sequence: Number(row.sequence),
    data: row.data,
  };
}
export function createSync(pool: Pool) {
  async function push(userId: string, input: unknown): Promise<PushResult> {
    const parsed = operationSchema.safeParse(input);
    if (!parsed.success) throw new SyncValidationError("Invalid operation");
    const operation = parsed.data;
    if (operation.data !== null) {
      const result = entitySchemas[operation.kind].safeParse(operation.data);
      if (!result.success || result.data.id !== operation.entityId)
        throw new SyncValidationError("Invalid entity");
      operation.data = result.data;
      if (
        operation.kind === "plan" &&
        (result.data as any).exerciseIds.some(
          (id: string) => !exercises.some((e) => e.id === id),
        )
      )
        throw new SyncValidationError("Unknown exercise");
    } else if (operation.kind === "settings")
      throw new SyncValidationError("Settings cannot be deleted");
    const digest = createHash("sha256")
      .update(JSON.stringify(operation))
      .digest("hex");
    return transaction(pool, async (client) => {
      // Serialize one user's writes, including sequence allocation and receipt commit.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `axon-sync:${userId}`,
      ]);
      const receipt = await client.query(
        "SELECT result,operation_hash FROM sync_receipts WHERE user_id=$1 AND operation_id=$2",
        [userId, operation.operationId],
      );
      if (receipt.rowCount) {
        if (receipt.rows[0].operation_hash !== digest)
          throw new SyncValidationError(
            "Operation ID was reused with different data",
          );
        return receipt.rows[0].result;
      }
      const existing = await client.query(
        "SELECT * FROM fitness_records WHERE user_id=$1 AND kind=$2 AND entity_id=$3",
        [userId, operation.kind, operation.entityId],
      );
      const current = existing.rows[0];
      let result: PushResult;
      if ((current?.version ?? 0) !== operation.baseVersion) {
        result = {
          status: "conflict",
          record: current
            ? envelope(current)
            : {
                kind: operation.kind,
                entityId: operation.entityId,
                version: 0,
                sequence: 0,
                data: null,
              },
        };
      } else {
        const record = await client.query(
          "INSERT INTO fitness_records(user_id,kind,entity_id,version,data) VALUES($1,$2,$3,1,$4::jsonb) ON CONFLICT(user_id,kind,entity_id) DO UPDATE SET version=fitness_records.version+1,data=excluded.data,sequence=nextval(pg_get_serial_sequence('fitness_records','sequence')) RETURNING *",
          [
            userId,
            operation.kind,
            operation.entityId,
            operation.data === null ? null : JSON.stringify(operation.data),
          ],
        );
        result = { status: "accepted", record: envelope(record.rows[0]) };
      }
      await client.query(
        "INSERT INTO sync_receipts(user_id,operation_id,operation_hash,result) VALUES($1,$2,$3,$4::jsonb)",
        [userId, operation.operationId, digest, JSON.stringify(result)],
      );
      return result;
    });
  }
  async function pull(userId: string, cursor: number) {
    if (!Number.isSafeInteger(cursor) || cursor < 0)
      throw new SyncValidationError("Invalid cursor");
    const result = await pool.query(
      "SELECT * FROM fitness_records WHERE user_id=$1 AND sequence>$2 ORDER BY sequence LIMIT 101",
      [userId, cursor],
    );
    const changes = result.rows.slice(0, 100).map(envelope);
    return {
      changes,
      cursor: changes.at(-1)?.sequence ?? cursor,
      hasMore: result.rows.length > 100,
    };
  }
  return { push, pull };
}
