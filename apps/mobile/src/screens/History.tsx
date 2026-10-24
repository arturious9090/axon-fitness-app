import React from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useApp } from "../lib/store";
import { Button, Card, Empty, Title } from "../components/ui";
import { SessionRow } from "./Overview";
import { WorkoutEditor } from "./Workout";
export function History() {
  const app = useApp(),
    { id } = useLocalSearchParams<{ id?: string }>();
  const workouts = app.workouts
    .filter((w) => w.finishedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const selected = workouts.find((w) => w.id === id);
  return selected ? (
    <>
      <Button
        title={app.t.back}
        variant="ghost"
        icon="arrow-left"
        onPress={() => router.replace("/history")}
      />
      <WorkoutEditor workout={selected} history />
    </>
  ) : (
    <>
      <Title>{app.t.history}</Title>
      {workouts.length ? (
        <Card style={{ gap: 0, paddingVertical: 5 }}>
          {workouts.map((w) => (
            <SessionRow
              key={w.id}
              workout={w}
              onPress={() =>
                router.push({ pathname: "/history", params: { id: w.id } })
              }
            />
          ))}
        </Card>
      ) : (
        <Empty title={app.t.noHistory} subtitle={app.t.noHistorySub} />
      )}
    </>
  );
}
