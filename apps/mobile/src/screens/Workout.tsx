import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  displayName,
  makeMovement,
  makeWorkout,
  numberInput,
  setCount,
  toDisplayWeight,
  toKilograms,
  type Workout as WorkoutData,
} from "@axon/core";
import { useApp } from "../lib/store";
import {
  Badge,
  Button,
  Card,
  Confirm,
  Dialog,
  Empty,
  Field,
  Icon,
  Label,
  Row,
  Title,
  colors,
} from "../components/ui";
import { ExercisePicker } from "./Library";

function Numeric({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <Field
      label={label}
      style={{ width: 80, textAlign: "center", paddingHorizontal: 5 }}
      value={text ?? String(value)}
      keyboardType="decimal-pad"
      onChangeText={(v) => {
        setText(v);
        const n = numberInput(v);
        if (n !== null) onChange(n);
      }}
      onBlur={() => setText(null)}
    />
  );
}
export function WorkoutEditor({
  workout,
  history = false,
}: {
  workout: WorkoutData;
  history?: boolean;
}) {
  const app = useApp(),
    { t, settings } = app,
    [pick, setPick] = useState(false),
    [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const mutate = (fn: (w: WorkoutData) => WorkoutData) =>
    app.mutate<WorkoutData>("workout", workout.id, fn);
  const remaining = Math.max(
    0,
    Math.ceil(((workout.restEndsAt ?? 0) - now) / 1000),
  );
  const earlier = app.workouts
    .filter(
      (w) =>
        w.finishedAt && w.id !== workout.id && w.startedAt < workout.startedAt,
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return (
    <>
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <View style={{ gap: 6 }}>
          <Badge>{history ? t.completed : t.workout}</Badge>
          <Title>{displayName(workout, settings.language)}</Title>
        </View>
        {!history && (
          <Confirm
            title={t.finishConfirm}
            description={t.finishHint}
            buttonTitle={t.finish}
            onConfirm={async () => {
              if (!setCount(workout)) {
                app.setError("finishEmpty");
                return;
              }
              await mutate((w) => ({
                ...w,
                finishedAt: new Date().toISOString(),
                restEndsAt: null,
              }));
              router.push("/history");
            }}
          />
        )}
      </Row>
      <Field
        label={t.workoutName}
        value={displayName(workout, settings.language)}
        maxLength={150}
        onChangeText={(name) => {
          if (name.trim())
            void mutate((w) => ({ ...w, name, nameTranslations: undefined }));
        }}
      />
      {!history && (
        <Card style={{ backgroundColor: "#22331e", borderColor: "#455a31" }}>
          <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <Row>
              <Icon name="clock" color={colors.lime} />
              <View>
                <Label>{t.rest}</Label>
                <Title small>
                  {remaining
                    ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
                    : t.restReady}
                </Title>
              </View>
            </Row>
            <Row>
              <Button
                title={remaining ? t.skip : t.start}
                compact
                variant="secondary"
                onPress={() =>
                  mutate((w) => ({
                    ...w,
                    restEndsAt: remaining
                      ? null
                      : Date.now() + w.restSeconds * 1000,
                  }))
                }
              />
              <Button
                title={`${workout.restSeconds} ${t.seconds}`}
                compact
                variant="ghost"
                onPress={() =>
                  mutate((w) => ({
                    ...w,
                    restSeconds:
                      w.restSeconds === 60
                        ? 90
                        : w.restSeconds === 90
                          ? 120
                          : 60,
                  }))
                }
              />
            </Row>
          </Row>
        </Card>
      )}
      {workout.movements.map((m, mi) => {
        const previous = earlier
          .flatMap((w) => w.movements)
          .find((mv) => mv.exerciseId === m.exerciseId);
        return (
          <Card key={m.id}>
            <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <Row>
                <Badge>{String(mi + 1).padStart(2, "0")}</Badge>
                <Title small>{m.name[settings.language]}</Title>
              </Row>
              <Button
                title={t.remove}
                variant="ghost"
                compact
                onPress={() =>
                  mutate((w) => ({
                    ...w,
                    movements: w.movements.filter((x) => x.id !== m.id),
                  }))
                }
              />
            </Row>
            {previous && (
              <Label small muted>
                {t.previous}:{" "}
                {previous.sets
                  .filter((s) => s.done)
                  .map(
                    (s) =>
                      `${app.format(toDisplayWeight(s.weight, settings.unit))} × ${s.reps}`,
                  )
                  .join(" / ")}{" "}
                {settings.unit}
              </Label>
            )}
            {m.sets.map((set, si) => (
              <Row
                key={set.id}
                style={{ justifyContent: "space-between", gap: 8 }}
              >
                <Label muted style={{ width: 24 }}>
                  {si + 1}
                </Label>
                <Numeric
                  label={settings.unit}
                  value={toDisplayWeight(set.weight, settings.unit)}
                  onChange={(n) =>
                    void mutate((w) => ({
                      ...w,
                      movements: w.movements.map((x) =>
                        x.id === m.id
                          ? {
                              ...x,
                              sets: x.sets.map((s) =>
                                s.id === set.id
                                  ? {
                                      ...s,
                                      weight: Math.min(
                                        2000,
                                        toKilograms(n, settings.unit),
                                      ),
                                    }
                                  : s,
                              ),
                            }
                          : x,
                      ),
                    }))
                  }
                />
                <Numeric
                  label={t.reps}
                  value={set.reps}
                  onChange={(n) =>
                    void mutate((w) => ({
                      ...w,
                      movements: w.movements.map((x) =>
                        x.id === m.id
                          ? {
                              ...x,
                              sets: x.sets.map((s) =>
                                s.id === set.id
                                  ? { ...s, reps: Math.min(999, Math.floor(n)) }
                                  : s,
                              ),
                            }
                          : x,
                      ),
                    }))
                  }
                />
                <View style={{ paddingTop: 24 }}>
                  <Button
                    title={set.done ? "✓" : "○"}
                    variant={set.done ? "primary" : "secondary"}
                    compact
                    onPress={() =>
                      mutate((w) => ({
                        ...w,
                        restEndsAt:
                          !history && !set.done
                            ? Date.now() + w.restSeconds * 1000
                            : w.restEndsAt,
                        movements: w.movements.map((x) =>
                          x.id === m.id
                            ? {
                                ...x,
                                sets: x.sets.map((s) =>
                                  s.id === set.id ? { ...s, done: !s.done } : s,
                                ),
                              }
                            : x,
                        ),
                      }))
                    }
                  />
                </View>
                <View style={{ paddingTop: 24 }}>
                  <Button
                    title="×"
                    compact
                    variant="ghost"
                    onPress={() =>
                      mutate((w) => ({
                        ...w,
                        movements: w.movements.map((x) =>
                          x.id === m.id
                            ? {
                                ...x,
                                sets: x.sets.filter((s) => s.id !== set.id),
                              }
                            : x,
                        ),
                      }))
                    }
                  />
                </View>
              </Row>
            ))}
            <Button
              title={t.addSet}
              variant="secondary"
              icon="plus"
              onPress={() =>
                mutate((w) => ({
                  ...w,
                  movements: w.movements.map((x) =>
                    x.id === m.id
                      ? {
                          ...x,
                          sets: [
                            ...x.sets,
                            {
                              id: randomUUID(),
                              weight: x.sets.at(-1)?.weight ?? 0,
                              reps: x.sets.at(-1)?.reps ?? 10,
                              done: false,
                            },
                          ],
                        }
                      : x,
                  ),
                }))
              }
            />
            <Field
              label={t.notes}
              placeholder={t.notesPlaceholder}
              value={m.notes}
              maxLength={2000}
              onChangeText={(notes) =>
                void mutate((w) => ({
                  ...w,
                  movements: w.movements.map((x) =>
                    x.id === m.id ? { ...x, notes } : x,
                  ),
                }))
              }
            />
          </Card>
        );
      })}
      <Button
        title={t.addExercise}
        icon="plus"
        variant="secondary"
        onPress={() => setPick(true)}
      />
      <Dialog
        visible={pick}
        title={t.addExercise}
        onClose={() => setPick(false)}
      >
        <ScrollView
          style={{ maxHeight: 500 }}
          keyboardShouldPersistTaps="handled"
        >
          <ExercisePicker
            onChoose={async (e) => {
              await mutate((w) => ({
                ...w,
                movements: [...w.movements, makeMovement(e.id, randomUUID)],
              }));
              setPick(false);
            }}
          />
        </ScrollView>
      </Dialog>
      <Confirm
        title={t.deleteConfirm}
        buttonTitle={t.delete}
        danger
        onConfirm={async () => {
          await app.change("workout", workout.id, null);
          router.push("/");
        }}
      />
    </>
  );
}
export function Workout() {
  const app = useApp();
  return app.active ? (
    <WorkoutEditor workout={app.active} />
  ) : (
    <>
      <Title>{app.t.workout}</Title>
      <Empty title={app.t.noHistory} subtitle={app.t.finishHint}>
        <Row style={{ flexWrap: "wrap" }}>
          <Button
            title={app.t.plans}
            variant="secondary"
            onPress={() => router.push("/plans")}
          />
          <Button
            title={app.t.newWorkout}
            icon="plus"
            onPress={async () => {
              const w = makeWorkout(app.t.newWorkout, [], randomUUID);
              await app.change("workout", w.id, w);
            }}
          />
        </Row>
      </Empty>
    </>
  );
}
