import { z } from "zod";
export * from "./catalog";

export type Language = "ru" | "en";
export type Localized = Record<Language, string>;
export type Exercise = {
  id: string;
  name: Localized;
  description: Localized;
  muscle: Localized;
  equipment: Localized;
  bodyweight?: boolean;
};

export const setSchema = z.object({
  id: z.uuid(),
  reps: z.number().int().min(0).max(999),
  weight: z.number().min(0).max(2000),
  done: z.boolean(),
});
export const movementSchema = z.object({
  id: z.uuid(),
  exerciseId: z.string().min(1).max(100),
  name: z.object({ ru: z.string().max(150), en: z.string().max(150) }),
  notes: z.string().max(2000),
  sets: z.array(setSchema).max(100),
});
export const planSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(150),
  nameTranslations: z
    .object({ ru: z.string().max(150), en: z.string().max(150) })
    .optional(),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  exerciseIds: z.array(z.string().max(100)).max(50),
  createdAt: z.iso.datetime(),
});
export const workoutSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(150),
  nameTranslations: z
    .object({ ru: z.string().max(150), en: z.string().max(150) })
    .optional(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  movements: z.array(movementSchema).max(50),
  restEndsAt: z.number().nullable(),
  restSeconds: z.number().int().min(15).max(1800),
});
export const settingsSchema = z.object({
  id: z.literal("settings"),
  language: z.enum(["ru", "en"]),
  unit: z.enum(["kg", "lb"]),
  name: z.string().max(150),
  timezone: z.string().max(100),
  reminders: z.boolean(),
  reminderHour: z.number().int().min(0).max(23),
});
export type Workout = z.infer<typeof workoutSchema>;
export type Movement = z.infer<typeof movementSchema>;
export type WorkoutSet = z.infer<typeof setSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type EntityKind = "workout" | "plan" | "settings";
export type Entity = Workout | Plan | Settings;
export const entitySchemas = {
  workout: workoutSchema,
  plan: planSchema,
  settings: settingsSchema,
};
export const operationSchema = z.object({
  operationId: z.uuid(),
  kind: z.enum(["workout", "plan", "settings"]),
  entityId: z.string().min(1).max(100),
  baseVersion: z.number().int().min(0),
  data: z.unknown().nullable(),
});
export type Operation = z.infer<typeof operationSchema>;
export type RecordEnvelope = {
  kind: EntityKind;
  entityId: string;
  version: number;
  sequence: number;
  data: Entity | null;
};
export type Conflict = { operation: Operation; remote: RecordEnvelope };
export type PushResult =
  | { status: "accepted"; record: RecordEnvelope }
  | { status: "conflict"; record: RecordEnvelope };
export type LocalState = {
  schemaVersion: 1;
  records: Record<string, RecordEnvelope>;
  outbox: Operation[];
  conflicts: Conflict[];
  cursor: number;
};

export const keyOf = (kind: EntityKind, id: string) => `${kind}:${id}`;
export const emptyState = (): LocalState => ({
  schemaVersion: 1,
  records: {},
  outbox: [],
  conflicts: [],
  cursor: 0,
});
export const defaultSettings = (language: Language = "ru"): Settings => ({
  id: "settings",
  language,
  unit: "kg",
  name: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  reminders: false,
  reminderHour: 18,
});
export const numberInput = (value: string) => {
  const n = Number(value.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
export const volume = (w: Workout) =>
  w.movements.reduce(
    (sum, m) =>
      sum +
      m.sets.filter((s) => s.done).reduce((n, s) => n + s.reps * s.weight, 0),
    0,
  );
export const setCount = (w: Workout) =>
  w.movements.reduce((sum, m) => sum + m.sets.filter((s) => s.done).length, 0);
export const durationMinutes = (w: Workout) =>
  Math.max(
    0,
    Math.round(
      ((w.finishedAt ? Date.parse(w.finishedAt) : Date.now()) -
        Date.parse(w.startedAt)) /
        60000,
    ),
  );
export const toDisplayWeight = (kg: number, unit: Settings["unit"]) =>
  unit === "lb" ? Math.round(kg * 2.2046226218 * 10) / 10 : kg;
export const toKilograms = (weight: number, unit: Settings["unit"]) =>
  unit === "lb" ? Math.round((weight / 2.2046226218) * 1000) / 1000 : weight;
export function recordsOf<T extends Entity>(
  state: LocalState,
  kind: EntityKind,
): T[] {
  return Object.values(state.records)
    .filter((r) => r.kind === kind && r.data !== null)
    .map((r) => r.data as T);
}

/** Call under the storage lock; the entity and its operation commit atomically. */
export function localChange(
  state: LocalState,
  kind: EntityKind,
  entityId: string,
  data: Entity | null,
  uuid: () => string,
): LocalState {
  const key = keyOf(kind, entityId);
  const current = state.records[key];
  const prior = state.outbox.find((o) => keyOf(o.kind, o.entityId) === key);
  // Coalesce unsent edits. Every edit gets a new receipt ID, including edits made during a request.
  const operation: Operation = {
    operationId: uuid(),
    kind,
    entityId,
    baseVersion: prior?.baseVersion ?? current?.version ?? 0,
    data,
  };
  const conflict = state.conflicts.find(
    (c) => keyOf(c.operation.kind, c.operation.entityId) === key,
  );
  if (conflict)
    return {
      ...state,
      records: { ...state.records, [key]: { ...current, data } },
      conflicts: state.conflicts.map((c) =>
        c === conflict ? { ...c, operation: { ...c.operation, data } } : c,
      ),
    };
  return {
    ...state,
    records: {
      ...state.records,
      [key]: {
        kind,
        entityId,
        version: current?.version ?? 0,
        sequence: current?.sequence ?? 0,
        data,
      },
    },
    outbox: [
      ...state.outbox.filter((o) => keyOf(o.kind, o.entityId) !== key),
      operation,
    ],
  };
}

export function applyPush(
  state: LocalState,
  operation: Operation,
  result: PushResult,
): LocalState {
  const key = keyOf(operation.kind, operation.entityId);
  const pending = state.outbox.find((o) => keyOf(o.kind, o.entityId) === key);
  if (result.status === "conflict") {
    const local = pending ?? operation;
    return {
      ...state,
      outbox: state.outbox.filter((o) => keyOf(o.kind, o.entityId) !== key),
      conflicts: [
        ...state.conflicts.filter(
          (c) => keyOf(c.operation.kind, c.operation.entityId) !== key,
        ),
        { operation: local, remote: result.record },
      ],
    };
  }
  const editedDuringRequest =
    pending && pending.operationId !== operation.operationId;
  return {
    ...state,
    records: {
      ...state.records,
      [key]: editedDuringRequest
        ? { ...result.record, data: state.records[key].data }
        : result.record,
    },
    outbox: state.outbox
      .filter((o) => o.operationId !== operation.operationId)
      .map((o) =>
        keyOf(o.kind, o.entityId) === key
          ? { ...o, baseVersion: result.record.version }
          : o,
      ),
  };
}

export function applyPull(
  state: LocalState,
  changes: RecordEnvelope[],
  cursor: number,
): LocalState {
  const records = { ...state.records };
  for (const r of changes) {
    const key = keyOf(r.kind, r.entityId);
    // Dirty data stays local until push detects and presents any conflict.
    if (
      state.outbox.some((o) => keyOf(o.kind, o.entityId) === key) ||
      state.conflicts.some(
        (c) => keyOf(c.operation.kind, c.operation.entityId) === key,
      )
    )
      continue;
    if (!records[key] || r.version > records[key].version) records[key] = r;
  }
  return { ...state, records, cursor };
}

export function resolveConflict(
  state: LocalState,
  conflict: Conflict,
  choice: "local" | "remote",
  uuid: () => string,
): LocalState {
  const key = keyOf(conflict.operation.kind, conflict.operation.entityId);
  const next = {
    ...state,
    records: { ...state.records, [key]: conflict.remote },
    conflicts: state.conflicts.filter(
      (c) => c.operation.operationId !== conflict.operation.operationId,
    ),
  };
  return choice === "remote"
    ? next
    : localChange(
        next,
        conflict.operation.kind,
        conflict.operation.entityId,
        conflict.operation.data as Entity | null,
        uuid,
      );
}

export const displayName = (
  entity: { name: string; nameTranslations?: Localized },
  language: Language,
) => entity.nameTranslations?.[language] ?? entity.name;

/** Validate persisted data before opening it. Never overwrite an unsupported newer document. */
export function restoreState(value: unknown): LocalState {
  const envelope = z.object({
    kind: z.enum(["workout", "plan", "settings"]),
    entityId: z.string(),
    version: z.number().int().min(0),
    sequence: z.number().int().min(0),
    data: z.unknown().nullable(),
  });
  const parsed = z
    .object({
      schemaVersion: z.literal(1),
      records: z.record(z.string(), envelope),
      outbox: z.array(operationSchema),
      conflicts: z.array(
        z.object({ operation: operationSchema, remote: envelope }),
      ),
      cursor: z.number().int().min(0),
    })
    .parse(value);
  for (const record of Object.values(parsed.records))
    if (record.data !== null) entitySchemas[record.kind].parse(record.data);
  return parsed as LocalState;
}
