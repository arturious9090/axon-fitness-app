import React, { useState, useEffect } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  displayName,
  durationMinutes,
  makeWorkout,
  setCount,
  templates,
  volume,
  type Workout,
} from "@axon/core";
import { useApp } from "../lib/store";
import {
  Badge,
  Button,
  Card,
  colors,
  Empty,
  Icon,
  Label,
  Row,
  Title,
} from "../components/ui";
import { Chart } from "../components/Chart";

export function SessionRow({
  workout,
  onPress,
}: {
  workout: Workout;
  onPress: () => void;
}) {
  const { t, settings, format, date, count } = useApp();
  return (
    <Row
      style={{
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderColor: colors.line,
        justifyContent: "space-between",
        flexWrap: "wrap",
      }}
    >
      <Row>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.panel2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="check" color={colors.lime} />
        </View>
        <View style={{ gap: 3 }}>
          <Label style={{ fontWeight: "600" }}>
            {displayName(workout, settings.language)}
          </Label>
          <Label small muted>
            {date(workout.startedAt)} · {durationMinutes(workout)} {t.minutes} ·{" "}
            {count(setCount(workout), "sets")}
          </Label>
        </View>
      </Row>
      <Button
        title={`${format(volume(workout))} kg ↗`}
        variant="ghost"
        onPress={onPress}
      />
    </Row>
  );
}
export function Overview() {
  const app = useApp(),
    { t, settings, format } = app,
    { width } = useWindowDimensions();
  const wide = width > 1100;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);
  const completed = app.workouts
    .filter((w) => w.finishedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const recent = completed.filter(
      (w) => Date.parse(w.startedAt) > now - 30 * 86400000,
    ),
    week = completed.filter(
      (w) => Date.parse(w.startedAt) > now - 7 * 86400000,
    );
  const plan =
    app.plans.find((p) => p.days.includes(new Date(now).getDay())) ??
    app.plans[0] ??
    templates(settings.language)[0];
  async function begin() {
    if (!app.active) {
      const w = makeWorkout(
        plan.name,
        plan.exerciseIds,
        randomUUID,
        plan.nameTranslations,
      );
      await app.change("workout", w.id, w);
    }
    router.push("/workout");
  }
  const chartSessions = recent.slice().reverse();
  return (
    <>
      <View style={{ gap: 8 }}>
        <Label small style={{ color: colors.lime }}>
          {app
            .date(now, { weekday: "long", day: "numeric", month: "long" })
            .toUpperCase()}
        </Label>
        <Title>{t.welcome}</Title>
        <Label muted>{t.welcomeSub}</Label>
      </View>
      <Row style={{ flexWrap: "wrap", alignItems: "stretch" }}>
        {[
          {
            label: t.sessions,
            value: week.length,
            icon: "calendar",
            suffix: t.week,
          },
          {
            label: t.volume,
            value: Math.round(recent.reduce((n, w) => n + volume(w), 0)),
            icon: "trending-up",
            suffix: `kg · ${t.last30}`,
          },
          {
            label: t.sets,
            value: recent.reduce((n, w) => n + setCount(w), 0),
            icon: "layers",
            suffix: t.last30,
          },
        ].map((metric) => (
          <Card key={metric.label} style={{ flex: 1, minWidth: 180 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Label muted>{metric.label}</Label>
              <Icon name={metric.icon as "calendar"} />
            </Row>
            <Text
              style={{
                fontSize: 38,
                fontWeight: "600",
                color: colors.text,
                letterSpacing: -1,
              }}
            >
              {format(metric.value)}
            </Text>
            <Label small muted>
              {metric.suffix}
            </Label>
          </Card>
        ))}
      </Row>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
        <Card style={{ flex: wide ? 1.5 : undefined, gap: 20 }}>
          <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <Title small>{t.trainingVolume}</Title>
            <Badge>{t.last30}</Badge>
          </Row>
          {chartSessions.length ? (
            <Chart
              points={chartSessions.map(volume)}
              labels={chartSessions.map((w) => app.date(w.startedAt))}
            />
          ) : (
            <Label muted>{t.noHistorySub}</Label>
          )}
          <Row>
            <Icon name="trending-up" color={colors.lime} />
            <Label small muted>
              {t.intro}
            </Label>
          </Row>
        </Card>
        <Card
          style={{
            flex: wide ? 1 : undefined,
            backgroundColor: "#22331e",
            borderColor: "#455a31",
            justifyContent: "space-between",
          }}
        >
          <Row style={{ justifyContent: "space-between" }}>
            <Badge>{t.nextSession}</Badge>
            <Icon name="arrow-up-right" color={colors.lime} />
          </Row>
          <View style={{ gap: 12, paddingVertical: 12 }}>
            <Title small>
              {displayName(app.active ?? plan, settings.language)}
            </Title>
            <Label muted>
              {app.count(plan.exerciseIds.length, "exercises")} · ~45{" "}
              {t.minutes}
            </Label>
            <Row style={{ flexWrap: "wrap" }}>
              {plan.days.map((d) => (
                <Badge key={d}>{t.dayNames[d]}</Badge>
              ))}
            </Row>
          </View>
          <Button
            title={app.active ? t.resume : t.start}
            icon="play"
            onPress={begin}
          />
        </Card>
      </View>
      <View style={{ gap: 16 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Title small>{t.recent}</Title>
          <Button
            title={t.allHistory}
            variant="ghost"
            compact
            onPress={() => router.push("/history")}
          />
        </Row>
        {completed.length ? (
          <Card style={{ gap: 0, paddingVertical: 5 }}>
            {completed.slice(0, 4).map((w) => (
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
          <Empty title={t.noHistory} subtitle={t.noHistorySub} />
        )}
      </View>
    </>
  );
}
