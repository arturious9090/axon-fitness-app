import React, { useState } from "react";
import { exercises, toDisplayWeight } from "@axon/core";
import { useApp } from "../lib/store";
import { Chart } from "../components/Chart";
import {
  Badge,
  Button,
  Card,
  Empty,
  Label,
  Row,
  Title,
} from "../components/ui";
export function Progress() {
  const app = useApp(),
    { t, settings } = app,
    [selected, setSelected] = useState("bench");
  const workouts = app.workouts
    .filter((w) => w.finishedAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const data = workouts.flatMap((w) => {
    const sets = w.movements
      .filter((m) => m.exerciseId === selected)
      .flatMap((m) => m.sets)
      .filter((s) => s.done);
    return sets.length
      ? [
          {
            date: app.date(w.startedAt),
            best: Math.max(
              ...sets.map((s) => toDisplayWeight(s.weight, settings.unit)),
            ),
            volume: sets.reduce((n, s) => n + s.weight * s.reps, 0),
          },
        ]
      : [];
  });
  return (
    <>
      <Title>{t.progress}</Title>
      <Row style={{ flexWrap: "wrap" }}>
        {exercises.map((e) => (
          <Button
            key={e.id}
            title={e.name[settings.language]}
            compact
            variant={e.id === selected ? "primary" : "secondary"}
            onPress={() => setSelected(e.id)}
          />
        ))}
      </Row>
      {data.length ? (
        <>
          <Card>
            <Row style={{ justifyContent: "space-between" }}>
              <Title small>{t.bestWeight}</Title>
              <Badge>
                {app.format(Math.max(...data.map((d) => d.best)))}{" "}
                {settings.unit}
              </Badge>
            </Row>
            <Chart
              points={data.map((d) => d.best)}
              labels={data.map((d) => d.date)}
            />
          </Card>
          <Card>
            <Title small>{t.trainingVolume} · kg</Title>
            <Chart
              points={data.map((d) => d.volume)}
              labels={data.map((d) => d.date)}
            />
          </Card>
          <Card>
            {data.map((d, i) => (
              <Row key={i} style={{ justifyContent: "space-between" }}>
                <Label muted>{d.date}</Label>
                <Label>
                  {app.format(d.best)} {settings.unit}
                </Label>
                <Label muted>{app.format(d.volume)} kg</Label>
              </Row>
            ))}
          </Card>
        </>
      ) : (
        <Empty title={t.emptyProgress} />
      )}
    </>
  );
}
