import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  applyPull,
  applyPush,
  emptyState,
  localChange,
  resolveConflict,
  restoreState,
  defaultSettings,
  numberInput,
  type RecordEnvelope,
} from "./index";

describe("durable sync state transitions", () => {
  it("coalesces offline edits while retaining the server base version", () => {
    let s = localChange(
      emptyState(),
      "settings",
      "settings",
      defaultSettings(),
      randomUUID,
    );
    const first = s.outbox[0].operationId;
    s = localChange(
      s,
      "settings",
      "settings",
      { ...defaultSettings(), name: "second" },
      randomUUID,
    );
    expect(s.outbox).toHaveLength(1);
    expect(s.outbox[0].operationId).not.toBe(first);
    expect(s.outbox[0].baseVersion).toBe(0);
    expect(
      JSON.parse(JSON.stringify(s)).records["settings:settings"].data.name,
    ).toBe("second");
  });
  it("does not lose an edit made while the earlier operation is in flight", () => {
    let s = localChange(
      emptyState(),
      "settings",
      "settings",
      defaultSettings(),
      randomUUID,
    );
    const sent = s.outbox[0];
    s = localChange(
      s,
      "settings",
      "settings",
      { ...defaultSettings(), name: "new edit" },
      randomUUID,
    );
    s = applyPush(s, sent, {
      status: "accepted",
      record: {
        kind: "settings",
        entityId: "settings",
        version: 1,
        sequence: 1,
        data: defaultSettings(),
      },
    });
    expect(s.outbox[0].baseVersion).toBe(1);
    expect((s.records["settings:settings"].data as any).name).toBe("new edit");
  });
  it("pull cannot overwrite dirty data and conflicting local/remote versions both survive", () => {
    let s = localChange(
      emptyState(),
      "settings",
      "settings",
      { ...defaultSettings(), name: "local" },
      randomUUID,
    );
    const sent = s.outbox[0];
    const remote: RecordEnvelope = {
      kind: "settings",
      entityId: "settings",
      version: 2,
      sequence: 5,
      data: { ...defaultSettings(), name: "remote" },
    };
    s = applyPull(s, [remote], 5);
    expect((s.records["settings:settings"].data as any).name).toBe("local");
    s = applyPush(s, sent, { status: "conflict", record: remote });
    expect(s.conflicts).toHaveLength(1);
    expect(s.outbox).toHaveLength(0);
    s = resolveConflict(s, s.conflicts[0], "local", randomUUID);
    expect(s.outbox[0].baseVersion).toBe(2);
    expect((s.records["settings:settings"].data as any).name).toBe("local");
  });
  it("propagates tombstones, never replaces a newer record with an older one", () => {
    const r: RecordEnvelope = {
      kind: "settings",
      entityId: "settings",
      version: 2,
      sequence: 5,
      data: null,
    };
    let s = applyPull(emptyState(), [r], 5);
    s = applyPull(s, [{ ...r, version: 1, data: defaultSettings() }], 5);
    expect(s.records["settings:settings"].data).toBeNull();
  });
});
it("keeps edits made while a conflict is awaiting a decision", () => {
  let state = localChange(
    emptyState(),
    "settings",
    "settings",
    defaultSettings(),
    randomUUID,
  );
  state = applyPush(state, state.outbox[0], {
    status: "conflict",
    record: {
      kind: "settings",
      entityId: "settings",
      version: 2,
      sequence: 2,
      data: defaultSettings(),
    },
  });
  state = localChange(
    state,
    "settings",
    "settings",
    { ...defaultSettings(), name: "latest edit" },
    randomUUID,
  );
  expect(state.outbox).toHaveLength(0);
  state = resolveConflict(state, state.conflicts[0], "local", randomUUID);
  expect((state.outbox[0].data as any).name).toBe("latest edit");
  expect(state.outbox[0].baseVersion).toBe(2);
});
it("restores the persisted format and rejects unsupported newer versions without changing them", () => {
  const state = localChange(
    emptyState(),
    "settings",
    "settings",
    defaultSettings(),
    randomUUID,
  );
  expect(restoreState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  const newer = { ...state, schemaVersion: 2 };
  expect(() => restoreState(newer)).toThrow();
  expect(newer.schemaVersion).toBe(2);
});
it("accepts decimal comma and rejects invalid weights", () => {
  expect(numberInput("12,5")).toBe(12.5);
  expect(numberInput("-1")).toBeNull();
  expect(numberInput("oops")).toBeNull();
});
