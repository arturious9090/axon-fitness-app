import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { exercises, type Exercise } from "@axon/core";
import { useApp } from "../lib/store";
import {
  Badge,
  Button,
  Card,
  colors,
  Field,
  Icon,
  Label,
  Row,
  Title,
} from "../components/ui";

export function ExercisePicker({
  onChoose,
  selected = [],
}: {
  onChoose: (exercise: Exercise) => void;
  selected?: string[];
}) {
  const { settings, t } = useApp(),
    [query, setQuery] = useState(""),
    [muscle, setMuscle] = useState("");
  const lang = settings.language;
  const groups = [...new Set(exercises.map((e) => e.muscle[lang]))];
  const filtered = exercises.filter(
    (e) =>
      (!muscle || e.muscle[lang] === muscle) &&
      [e.name[lang], e.muscle[lang], e.equipment[lang]]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  return (
    <View style={{ gap: 16 }}>
      <Field placeholder={t.search} value={query} onChangeText={setQuery} />
      <Row style={{ flexWrap: "wrap" }}>
        <Button
          title={t.all}
          compact
          variant={muscle ? "secondary" : "primary"}
          onPress={() => setMuscle("")}
        />
        {groups.map((g) => (
          <Button
            key={g}
            title={g}
            compact
            variant={muscle === g ? "primary" : "secondary"}
            onPress={() => setMuscle(g)}
          />
        ))}
      </Row>
      {!filtered.length && <Label muted>{t.noResults}</Label>}
      {filtered.map((e) => (
        <Pressable
          key={e.id}
          accessibilityRole="button"
          accessibilityLabel={e.name[lang]}
          onPress={() => onChoose(e)}
        >
          <Row
            style={{
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderColor: colors.line,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: colors.panel2,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon
                name={selected.includes(e.id) ? "check" : "plus"}
                color={colors.lime}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Label style={{ fontWeight: "600" }}>{e.name[lang]}</Label>
              <Label small muted>
                {e.muscle[lang]} · {e.equipment[lang]}
              </Label>
            </View>
          </Row>
        </Pressable>
      ))}
    </View>
  );
}
export function Library() {
  const { t, settings } = useApp(),
    [selected, setSelected] = useState<Exercise | null>(null);
  return (
    <>
      <Title>{t.library}</Title>
      {selected && (
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Title small>{selected.name[settings.language]}</Title>
            <Button
              title="×"
              compact
              variant="ghost"
              onPress={() => setSelected(null)}
            />
          </Row>
          <Badge>{selected.muscle[settings.language]}</Badge>
          <Label muted>{selected.description[settings.language]}</Label>
        </Card>
      )}
      <Card>
        <ExercisePicker onChoose={setSelected} />
      </Card>
    </>
  );
}
