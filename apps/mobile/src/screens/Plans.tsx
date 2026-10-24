import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  displayName,
  exercises,
  makeWorkout,
  templates,
  type Plan,
} from "@axon/core";
import { useApp } from "../lib/store";
import {
  Badge,
  Button,
  Card,
  Confirm,
  Dialog,
  Field,
  Label,
  Row,
  Title,
} from "../components/ui";
import { ExercisePicker } from "./Library";
export function Plans() {
  const app = useApp(),
    { t, settings } = app,
    [editing, setEditing] = useState<Plan | null>(null),
    [pick, setPick] = useState(false);
  async function start(plan: Plan) {
    if (app.active) {
      app.setError("activeExists");
      router.push("/workout");
      return;
    }
    const w = makeWorkout(
      plan.name,
      plan.exerciseIds,
      randomUUID,
      plan.nameTranslations,
    );
    await app.change("workout", w.id, w);
    router.push("/workout");
  }
  return (
    <>
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <Title>{t.plans}</Title>
        <Button
          title={t.newPlan}
          icon="plus"
          onPress={() =>
            setEditing({
              id: randomUUID(),
              name: "",
              days: [],
              exerciseIds: [],
              createdAt: new Date().toISOString(),
            })
          }
        />
      </Row>
      <View style={{ flexDirection: "row", gap: 18, flexWrap: "wrap" }}>
        {app.plans.map((plan) => (
          <Card key={plan.id} style={{ flexGrow: 1, flexBasis: 300 }}>
            <Badge>{app.count(plan.exerciseIds.length, "exercises")}</Badge>
            <Title small>{displayName(plan, settings.language)}</Title>
            <Row style={{ flexWrap: "wrap" }}>
              {plan.days.map((d) => (
                <Badge key={d}>{t.dayNames[d]}</Badge>
              ))}
            </Row>
            <View style={{ gap: 9, paddingVertical: 8 }}>
              {plan.exerciseIds.map((id, i) => (
                <Label key={`${id}-${i}`} muted>
                  {String(i + 1).padStart(2, "0")}{" "}
                  {exercises.find((e) => e.id === id)?.name[settings.language]}
                </Label>
              ))}
            </View>
            <Button title={t.start} icon="play" onPress={() => start(plan)} />
            <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <Button
                title={t.edit}
                variant="ghost"
                icon="edit-2"
                onPress={() => setEditing(plan)}
              />
              <Confirm
                title={t.deleteConfirm}
                buttonTitle={t.delete}
                danger
                onConfirm={() => app.change("plan", plan.id, null)}
              />
            </Row>
          </Card>
        ))}
      </View>
      {!app.plans.length && (
        <Card>
          <Title small>{t.noPlans}</Title>
          <Row style={{ flexWrap: "wrap" }}>
            {templates(settings.language).map((template) => (
              <Button
                key={template.id}
                title={template.name}
                variant="secondary"
                onPress={() => {
                  const id = randomUUID();
                  return app.change("plan", id, {
                    ...template,
                    id,
                    createdAt: new Date().toISOString(),
                  });
                }}
              />
            ))}
          </Row>
        </Card>
      )}
      <Dialog
        visible={!!editing}
        title={t.plans}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <ScrollView
            style={{ maxHeight: 540 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 18 }}
          >
            <Field
              label={t.planName}
              value={displayName(editing, settings.language)}
              onChangeText={(name) =>
                setEditing({ ...editing, name, nameTranslations: undefined })
              }
              maxLength={150}
            />
            <Label muted>{t.schedule}</Label>
            <Row style={{ flexWrap: "wrap" }}>
              {t.dayNames.map((day, i) => (
                <Button
                  key={day}
                  title={day}
                  compact
                  variant={editing.days.includes(i) ? "primary" : "secondary"}
                  onPress={() =>
                    setEditing({
                      ...editing,
                      days: editing.days.includes(i)
                        ? editing.days.filter((d) => d !== i)
                        : [...editing.days, i],
                    })
                  }
                />
              ))}
            </Row>
            {editing.exerciseIds.map((id, i) => (
              <Row
                key={`${id}-${i}`}
                style={{ justifyContent: "space-between" }}
              >
                <Label>
                  {exercises.find((e) => e.id === id)?.name[settings.language]}
                </Label>
                <Button
                  title="×"
                  compact
                  variant="ghost"
                  onPress={() =>
                    setEditing({
                      ...editing,
                      exerciseIds: editing.exerciseIds.filter(
                        (_, n) => n !== i,
                      ),
                    })
                  }
                />
              </Row>
            ))}
            <Button
              title={t.addExercise}
              variant="secondary"
              onPress={() => setPick(!pick)}
            />
            {pick && (
              <ExercisePicker
                selected={editing.exerciseIds}
                onChoose={(e) =>
                  setEditing({
                    ...editing,
                    exerciseIds: editing.exerciseIds.includes(e.id)
                      ? editing.exerciseIds.filter((id) => id !== e.id)
                      : [...editing.exerciseIds, e.id],
                  })
                }
              />
            )}
            <Button
              title={t.save}
              disabled={!editing.name.trim() || !editing.exerciseIds.length}
              onPress={async () => {
                await app.change("plan", editing.id, {
                  ...editing,
                  name: editing.name.trim(),
                });
                setEditing(null);
              }}
            />
          </ScrollView>
        )}
      </Dialog>
    </>
  );
}
