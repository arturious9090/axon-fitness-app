import React, { useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { authClient } from "../lib/auth-client";
import { useApp } from "../lib/store";
import { dictionaries } from "../lib/i18n";
import { Logo } from "../components/Shell";
import {
  Badge,
  Button,
  Card,
  colors,
  Field,
  Label,
  Row,
  Title,
} from "../components/ui";
export function Account() {
  const app = useApp(),
    { width } = useWindowDimensions(),
    params = useLocalSearchParams<{ token?: string; error?: string }>(),
    [mode, setMode] = useState<
      "login" | "signup" | "forgot" | "verify" | "reset"
    >(params.token ? "reset" : "login");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [message, setMessage] = useState("");
  const language = app.identity ? app.settings.language : app.guestLanguage,
    t = dictionaries[language];
  async function submit() {
    setMessage("");
    try {
      if (mode === "login") {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (result.error) {
          setMessage(
            result.error.code === "EMAIL_NOT_VERIFIED"
              ? t.verifyRequired
              : t.invalid,
          );
          return;
        }
        await app.enter(result.data.user);
        router.replace("/");
      } else if (mode === "signup") {
        const result = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim(),
          callbackURL: "/account",
          fetchOptions: { headers: { "x-axon-language": language } },
        });
        if (result.error) {
          setMessage(t.invalid);
          return;
        }
        setMode("verify");
      } else if (mode === "forgot") {
        await authClient.requestPasswordReset({
          email: email.trim(),
          redirectTo: "/reset-password",
          fetchOptions: { headers: { "x-axon-language": language } },
        });
        setMessage(t.resetSent);
      } else if (mode === "reset") {
        const result = await authClient.resetPassword({
          newPassword: password,
          token: params.token,
        });
        if (result.error) {
          setMessage(t.invalid);
          return;
        }
        setMode("login");
        setMessage(t.changeSaved);
      }
    } catch {
      setMessage(t.accountUnavailable);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          padding: width > 800 ? 48 : 22,
          gap: 50,
          maxWidth: 1280,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <Logo />
          <Row>
            {(["ru", "en"] as const).map((l) => (
              <Button
                key={l}
                title={l.toUpperCase()}
                compact
                variant={language === l ? "primary" : "ghost"}
                onPress={async () => {
                  app.setGuestLanguage(l);
                  if (app.identity)
                    await app.change("settings", "settings", {
                      ...app.settings,
                      language: l,
                    });
                }}
              />
            ))}
          </Row>
        </Row>
        <View
          style={{
            flexDirection: width > 900 ? "row" : "column",
            gap: width > 900 ? 80 : 30,
            alignItems: "center",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <View style={{ flex: 1, gap: 28, paddingVertical: 30 }}>
            <Badge>AXON / STRENGTH JOURNAL</Badge>
            <Title>{t.intro}</Title>
            <Label
              muted
              style={{ fontSize: 18, lineHeight: 29, maxWidth: 500 }}
            >
              {t.introSub}
            </Label>
            <Row style={{ gap: 32 }}>
              {["01 / PLAN", "02 / TRAIN", "03 / PROGRESS"].map((s) => (
                <Label key={s} small style={{ color: colors.lime }}>
                  {s}
                </Label>
              ))}
            </Row>
            <View style={{ gap: 10, alignSelf: "flex-start", marginTop: 16 }}>
              <Button
                title={t.tryDemo}
                icon="arrow-up-right"
                onPress={async () => {
                  await app.enter({ id: "demo", name: "Alex", email: "" });
                  router.replace("/");
                }}
              />
              <Label small muted>
                {t.demoInfo}
              </Label>
            </View>
          </View>
          <Card style={{ width: "100%", maxWidth: 430, gap: 22 }}>
            <Title small>
              {mode === "signup"
                ? t.signup
                : mode === "forgot"
                  ? t.forgot
                  : mode === "verify"
                    ? t.checkEmail
                    : mode === "reset"
                      ? t.resetPassword
                      : t.login}
            </Title>
            {!!message && (
              <Label style={{ color: colors.lime }}>{message}</Label>
            )}
            {params.error && (
              <Label style={{ color: colors.danger }}>{t.invalid}</Label>
            )}
            {mode === "verify" ? (
              <>
                <Label muted>{t.checkEmailHint}</Label>
                <Button
                  title={t.resend}
                  variant="secondary"
                  onPress={async () => {
                    const result = await authClient.sendVerificationEmail({
                      email: email.trim(),
                      callbackURL: "/account",
                      fetchOptions: {
                        headers: { "x-axon-language": language },
                      },
                    });
                    setMessage(result.error ? t.error : t.checkEmail);
                  }}
                />
              </>
            ) : (
              <>
                {mode === "signup" && (
                  <Field
                    label={t.name}
                    value={name}
                    onChangeText={setName}
                    maxLength={150}
                    autoComplete="name"
                  />
                )}
                {mode !== "reset" && (
                  <Field
                    label={t.email}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                )}
                {mode !== "forgot" && (
                  <Field
                    label={mode === "reset" ? t.resetPassword : t.password}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    onSubmitEditing={() => void submit()}
                  />
                )}
                {mode === "signup" && (
                  <Label small muted>
                    {t.consent}
                  </Label>
                )}
                <Button
                  title={
                    mode === "signup"
                      ? t.signup
                      : mode === "forgot"
                        ? t.sendReset
                        : mode === "reset"
                          ? t.resetSubmit
                          : t.login
                  }
                  onPress={submit}
                  disabled={
                    mode === "reset"
                      ? password.length < 10
                      : !email.includes("@") ||
                        (mode !== "forgot" && password.length < 10) ||
                        (mode === "signup" && !name.trim())
                  }
                />
              </>
            )}
            {mode === "login" ? (
              <>
                <Button
                  title={t.forgot}
                  variant="ghost"
                  onPress={() => {
                    setMode("forgot");
                    setMessage("");
                  }}
                />
                <Button
                  title={t.signup}
                  variant="secondary"
                  onPress={() => {
                    setMode("signup");
                    setMessage("");
                  }}
                />
              </>
            ) : (
              <Button
                title={t.backLogin}
                variant="ghost"
                onPress={() => {
                  setMode("login");
                  setMessage("");
                }}
              />
            )}
          </Card>
        </View>
        <Label small muted>
          {t.demoLabel}
        </Label>
      </ScrollView>
    </SafeAreaView>
  );
}
