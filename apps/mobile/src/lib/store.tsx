import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { AppState, Platform } from "react-native";
import { randomUUID } from "expo-crypto";
import {
  applyPull,
  applyPush,
  defaultSettings,
  demoState,
  emptyState,
  keyOf,
  localChange,
  recordsOf,
  resolveConflict,
  restoreState,
  type Conflict,
  type Entity,
  type EntityKind,
  type Language,
  type LocalState,
  type Plan,
  type Settings,
  type Workout,
} from "@axon/core";
import * as storage from "./storage";
import { api, authClient } from "./auth-client";
import { dictionaries } from "./i18n";
import { scheduleReminders, scheduleRest } from "./notifications";

export type Identity = { id: string; name: string; email: string };
function useStore() {
  const [identity, setIdentity] = useState<Identity | null>(null),
    [ready, setReady] = useState(false),
    [state, setState] = useState<LocalState>(emptyState()),
    [error, setError] = useState(""),
    [syncing, setSyncing] = useState(false),
    [online, setOnline] = useState(true),
    [guestLanguage, setGuestLanguage] = useState<Language>("ru");
  const identityRef = useRef<Identity | null>(null);
  const syncingRef = useRef(false);
  const settings =
      recordsOf<Settings>(state, "settings")[0] ??
      defaultSettings(guestLanguage),
    t = dictionaries[settings.language];
  const plans = recordsOf<Plan>(state, "plan"),
    workouts = recordsOf<Workout>(state, "workout");
  const active = workouts.find((w) => !w.finishedAt);
  useEffect(() => {
    storage
      .read<Identity | null>("identity")
      .then(async (user) => {
        if (user) {
          const local = await storage.read<LocalState>(`account:${user.id}`);
          setState(local ? restoreState(local) : emptyState());
          identityRef.current = user;
          setIdentity(user);
        }
        setReady(true);
      })
      .catch(() => {
        setError("storageError");
        setReady(true);
      });
  }, []);
  const update = useCallback(async (change: (s: LocalState) => LocalState) => {
    const user = identityRef.current;
    if (!user) throw new Error("No account");
    try {
      const next = await storage.transact<LocalState>(
        `account:${user.id}`,
        (old) => change(old ? restoreState(old) : emptyState()),
      );
      if (identityRef.current?.id === user.id) setState(next);
      return next;
    } catch (e) {
      setError("storageError");
      throw e;
    }
  }, []);
  const change = useCallback(
    async (kind: EntityKind, id: string, data: Entity | null) => {
      await update((s) =>
        identityRef.current?.id === "demo"
          ? {
              ...s,
              records: {
                ...s.records,
                [keyOf(kind, id)]: {
                  kind,
                  entityId: id,
                  data,
                  version: 0,
                  sequence: 0,
                },
              },
            }
          : localChange(s, kind, id, data, randomUUID),
      );
    },
    [update],
  );
  const mutate = useCallback(
    async <T extends Entity>(
      kind: EntityKind,
      id: string,
      fn: (entity: T) => T,
    ) => {
      await update((s) => {
        const record = s.records[keyOf(kind, id)];
        if (!record?.data) return s;
        const data = fn(record.data as T);
        return identityRef.current?.id === "demo"
          ? {
              ...s,
              records: { ...s.records, [keyOf(kind, id)]: { ...record, data } },
            }
          : localChange(s, kind, id, data, randomUUID);
      });
    },
    [update],
  );
  async function enter(user: Identity) {
    const existing = await storage.read<LocalState>(`account:${user.id}`);
    let initial =
      user.id === "demo" ? demoState(randomUUID, guestLanguage) : emptyState();
    if (!existing && user.id !== "demo") {
      let more = true;
      while (more) {
        const result = await api(`/api/sync/pull?cursor=${initial.cursor}`);
        initial = applyPull(initial, result.changes, result.cursor);
        more = result.hasMore;
      }
    }
    const local = await storage.transact<LocalState>(
      `account:${user.id}`,
      (old) => (old ? restoreState(old) : initial),
    );
    await storage.transact<Identity | null>("identity", () => user);
    setState(local);
    identityRef.current = user;
    setIdentity(user);
    setError("");
    if (user.id !== "demo" && !local.records["settings:settings"])
      await change("settings", "settings", {
        ...defaultSettings(guestLanguage),
        name: user.name,
      });
    if (Platform.OS === "web")
      void storage.requestPersistence().catch(() => {});
  }
  async function signout() {
    await scheduleRest(null, settings.language);
    await scheduleReminders({ ...settings, reminders: false }, []);
    if (identity?.id !== "demo") {
      await authClient.signOut().catch(() => {});
    }
    await storage.transact<Identity | null>("identity", () => null);
    identityRef.current = null;
    setIdentity(null);
    setState(emptyState());
  }
  const sync = useCallback(async () => {
    const user = identityRef.current;
    if (!user || user.id === "demo" || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      let current =
        (await storage.read<LocalState>(`account:${user.id}`)) ?? emptyState();
      for (const op of current.outbox) {
        const result = await api("/api/sync/push", {
          method: "POST",
          body: JSON.stringify(op),
        });
        if (identityRef.current?.id !== user.id) return;
        current = await update((s) => applyPush(s, op, result));
      }
      let more = true;
      while (more) {
        const result = await api(`/api/sync/pull?cursor=${current.cursor}`);
        if (identityRef.current?.id !== user.id) return;
        current = await update((s) =>
          applyPull(s, result.changes, result.cursor),
        );
        more = result.hasMore;
      }
      setOnline(true);
      setError("");
    } catch (e) {
      const expired = e instanceof Error && e.message === "AUTH_EXPIRED";
      setError(expired ? "authExpired" : "");
      setOnline(false);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [update]);
  useEffect(() => {
    if (!identity || identity.id === "demo") return;
    const initial = setTimeout(() => void sync(), 0);
    const timer = setInterval(() => void sync(), 15000);
    const listener = AppState.addEventListener("change", (status) => {
      if (status === "active") void sync();
    });
    const onOnline = () => void sync();
    if (Platform.OS === "web") window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      listener.remove();
      if (Platform.OS === "web") window.removeEventListener("online", onOnline);
    };
  }, [identity, sync]);
  useEffect(() => {
    const timer = setTimeout(() => void sync(), 1500);
    return () => clearTimeout(timer);
  }, [state.outbox, sync]);
  const scheduleSignature = JSON.stringify({
    id: identity?.id,
    settings: {
      reminders: settings.reminders,
      language: settings.language,
      reminderHour: settings.reminderHour,
    },
    days: plans.flatMap((p) => p.days),
  });
  useEffect(() => {
    if (ready) {
      const spec = JSON.parse(scheduleSignature);
      void scheduleReminders(spec.settings, spec.days).catch(() =>
        setError("error"),
      );
    }
  }, [scheduleSignature, ready]);
  useEffect(() => {
    void scheduleRest(active?.restEndsAt ?? null, settings.language).catch(
      () => {},
    );
  }, [active?.restEndsAt, settings.language]);
  return {
    identity,
    ready,
    state,
    settings,
    t,
    plans,
    workouts,
    active,
    error,
    setError,
    syncing,
    online,
    guestLanguage,
    setGuestLanguage,
    enter,
    signout,
    change,
    mutate,
    sync,
    resolve: async (c: Conflict, choice: "local" | "remote") => {
      await update((s) => resolveConflict(s, c, choice, randomUUID));
    },
    resetDemo: async () => {
      await update(() => demoState(randomUUID, settings.language));
    },
    date: (
      value: string | number | Date,
      options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
    ) =>
      new Intl.DateTimeFormat(settings.language, {
        timeZone: settings.timezone,
        ...options,
      }).format(new Date(value)),
    count: (n: number, kind: "sets" | "exercises" | "sessions") => {
      const forms =
        settings.language === "ru"
          ? {
              sets: ["подход", "подхода", "подходов"],
              exercises: ["упражнение", "упражнения", "упражнений"],
              sessions: ["тренировка", "тренировки", "тренировок"],
            }
          : {
              sets: ["set", "sets", "sets"],
              exercises: ["exercise", "exercises", "exercises"],
              sessions: ["session", "sessions", "sessions"],
            };
      const p = new Intl.PluralRules(settings.language).select(n);
      return `${n} ${forms[kind][p === "one" ? 0 : p === "few" ? 1 : 2]}`;
    },
    format: (n: number) =>
      new Intl.NumberFormat(settings.language, {
        maximumFractionDigits: 1,
      }).format(n),
  };
}
const Store = createContext<ReturnType<typeof useStore> | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  return <Store.Provider value={useStore()}>{children}</Store.Provider>;
}
export function useApp() {
  const store = useContext(Store);
  if (!store) throw new Error("Missing StoreProvider");
  return store;
}
