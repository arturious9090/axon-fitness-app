import React, { useState } from "react";
import { Platform, Switch } from "react-native";
import { router } from "expo-router";
import { type Settings as Profile } from "@axon/core";
import { useApp } from "../lib/store";
import { authClient } from "../lib/auth-client";
import * as storage from "../lib/storage";
import { enableReminders } from "../lib/notifications";
import {
  Button,
  Card,
  Confirm,
  Field,
  Label,
  Row,
  Title,
  colors,
} from "../components/ui";
export function Settings() {
  const app = useApp(),
    { t, settings } = app,
    [name, setName] = useState(settings.name),
    [timezone, setTimezone] = useState(settings.timezone),
    [password, setPassword] = useState("");
  const patch = (data: Partial<Profile>) =>
    app.mutate<Profile>("settings", "settings", (s) => ({ ...s, ...data }));
  return (
    <>
      <Title>{t.settings}</Title>
      <Card>
        <Title small>{t.profile}</Title>
        <Field
          label={t.name}
          value={name}
          onChangeText={setName}
          maxLength={150}
        />
        <Field label={t.timezone} value={timezone} onChangeText={setTimezone} />
        <Button
          title={t.save}
          onPress={async () => {
            try {
              new Intl.DateTimeFormat("en", { timeZone: timezone });
            } catch {
              app.setError("invalid");
              return;
            }
            await patch({ name: name.trim(), timezone });
          }}
        />
      </Card>
      <Card>
        <Label>{t.language}</Label>
        <Row>
          <Button
            title="Русский"
            variant={settings.language === "ru" ? "primary" : "secondary"}
            onPress={() => patch({ language: "ru" })}
          />
          <Button
            title="English"
            variant={settings.language === "en" ? "primary" : "secondary"}
            onPress={() => patch({ language: "en" })}
          />
        </Row>
        <Label>{t.units}</Label>
        <Row>
          {(["kg", "lb"] as const).map((unit) => (
            <Button
              key={unit}
              title={unit}
              variant={settings.unit === unit ? "primary" : "secondary"}
              onPress={() => patch({ unit })}
            />
          ))}
        </Row>
      </Card>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Title small>{t.reminders}</Title>
          <Switch
            accessibilityLabel={t.reminders}
            value={settings.reminders}
            disabled={Platform.OS === "web"}
            trackColor={{ true: colors.lime }}
            onValueChange={async (value) => {
              if (value && !(await enableReminders())) {
                app.setError("permissionDenied");
                return;
              }
              await patch({ reminders: value });
            }}
          />
        </Row>
        {Platform.OS === "web" ? (
          <Label muted>{t.remindersWeb}</Label>
        ) : (
          <Field
            label={t.reminderHour}
            value={String(settings.reminderHour)}
            keyboardType="number-pad"
            onChangeText={(v) => {
              const n = Number(v);
              if (Number.isInteger(n) && n >= 0 && n <= 23)
                void patch({ reminderHour: n });
            }}
          />
        )}
      </Card>
      <Card>
        <Title small>{t.account}</Title>
        <Label muted>{app.identity?.email || t.demoLabel}</Label>
        {app.identity?.id !== "demo" && (
          <Button
            title={t.sync}
            icon="refresh-cw"
            variant="secondary"
            onPress={app.sync}
          />
        )}
        <Confirm
          title={t.signout}
          description={app.state.outbox.length ? t.signoutPending : undefined}
          onConfirm={async () => {
            await app.signout();
            router.replace("/");
          }}
        />
        {app.identity?.id === "demo" ? (
          <Confirm
            title={t.demoResetHint}
            buttonTitle={t.demoReset}
            danger
            onConfirm={app.resetDemo}
          />
        ) : (
          <>
            <Field
              label={t.password}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Confirm
              title={t.deleteAccount}
              description={t.deleteAccountHint}
              danger
              onConfirm={async () => {
                const result = await authClient.deleteUser({ password });
                if (result.error) {
                  app.setError("invalid");
                  return;
                }
                await storage.transact(
                  `account:${app.identity!.id}`,
                  () => null,
                );
                await app.signout();
                router.replace("/");
              }}
            />
          </>
        )}
      </Card>
    </>
  );
}
