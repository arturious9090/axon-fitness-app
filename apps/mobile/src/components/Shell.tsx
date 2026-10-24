import React from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Link, usePathname } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge, Button, Card, colors, Icon, Label, Row } from "./ui";
import { useApp } from "../lib/store";

const nav = [
  { href: "/", key: "overview", icon: "grid" },
  { href: "/plans", key: "plans", icon: "layers" },
  { href: "/workout", key: "workout", icon: "play-circle" },
  { href: "/history", key: "history", icon: "clock" },
  { href: "/progress", key: "progress", icon: "bar-chart-2" },
  { href: "/library", key: "library", icon: "book-open" },
  { href: "/settings", key: "settings", icon: "sliders" },
] as const;
export function Logo() {
  return (
    <Row style={{ gap: 10 }}>
      <View
        style={{
          backgroundColor: colors.lime,
          width: 35,
          height: 35,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="activity" color={colors.bg} size={22} />
      </View>
      <Text
        style={{
          color: colors.text,
          fontSize: 24,
          fontWeight: "800",
          letterSpacing: -1,
        }}
      >
        axon
        <Text
          style={{
            color: colors.muted,
            fontSize: 13,
            fontWeight: "500",
            letterSpacing: 0,
          }}
        >
          {" "}
          / fitness
        </Text>
      </Text>
    </Row>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const app = useApp(),
    { width } = useWindowDimensions(),
    wide = width >= 900,
    path = usePathname();
  const status =
    app.identity?.id === "demo"
      ? app.t.saved
      : app.syncing
        ? app.t.syncing
        : !app.online
          ? app.t.offline
          : app.state.outbox.length
            ? app.t.saved
            : app.t.synced;
  function item(n: (typeof nav)[number], mobile = false) {
    const selected = path === n.href;
    return (
      <Link key={n.href} href={n.href} asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityState={{ selected }}
          accessibilityLabel={app.t[n.key]}
          style={({ pressed }) => ({
            flexDirection: mobile ? "column" : "row",
            alignItems: "center",
            gap: mobile ? 4 : 13,
            paddingHorizontal: mobile ? 2 : 16,
            paddingVertical: mobile ? 8 : 13,
            borderRadius: 12,
            backgroundColor: selected
              ? colors.panel2
              : pressed
                ? colors.panel
                : "transparent",
            flex: mobile ? 1 : undefined,
          })}
        >
          <Icon
            name={n.icon}
            size={mobile ? 20 : 19}
            color={selected ? colors.lime : colors.muted}
          />
          <Text
            numberOfLines={1}
            style={{
              fontSize: mobile ? 9 : 14,
              color: selected ? colors.text : colors.muted,
              fontWeight: selected ? "600" : "400",
            }}
          >
            {app.t[n.key]}
          </Text>
          {!mobile && selected && (
            <View
              style={{
                marginLeft: "auto",
                height: 6,
                width: 6,
                borderRadius: 3,
                backgroundColor: colors.lime,
              }}
            />
          )}
        </Pressable>
      </Link>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        {wide && (
          <View
            style={{
              width: 232,
              padding: 24,
              borderRightWidth: 1,
              borderColor: colors.line,
              gap: 32,
            }}
          >
            <Logo />
            <Label small muted>
              WORKSPACE
            </Label>
            <View style={{ gap: 6 }}>{nav.map((n) => item(n))}</View>
            <View style={{ marginTop: "auto", gap: 12 }}>
              <Badge>
                {app.identity?.id === "demo" ? app.t.demo : "AXON MEMBER"}
              </Badge>
              <Label>{app.settings.name || app.identity?.name}</Label>
              <Label small muted>
                {app.t.intro}
              </Label>
            </View>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Row
            style={{
              justifyContent: "space-between",
              paddingHorizontal: wide ? 36 : 18,
              paddingVertical: 18,
              borderBottomWidth: 1,
              borderColor: colors.line,
            }}
          >
            {wide ? (
              <Label muted small>
                {app.t.trainingLog}
              </Label>
            ) : (
              <Logo />
            )}
            <Row>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: app.online ? colors.lime : colors.danger,
                }}
              />
              <Label small muted>
                {width < 500
                  ? app.identity?.id === "demo"
                    ? app.t.demo
                    : app.state.outbox.length
                      ? app.t.saved
                      : app.t.synced
                  : status}
              </Label>
            </Row>
          </Row>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: wide ? 36 : 18,
              gap: 28,
              maxWidth: 1280,
              width: "100%",
              alignSelf: "center",
              paddingBottom: 40,
            }}
          >
            {app.identity?.id === "demo" && (
              <Row
                style={{ justifyContent: "space-between", flexWrap: "wrap" }}
              >
                <Label small muted>
                  {app.t.demoLabel}
                </Label>
                <Link href="/account" asChild>
                  <Pressable>
                    <Label small style={{ color: colors.lime }}>
                      {app.t.signup} ↗
                    </Label>
                  </Pressable>
                </Link>
              </Row>
            )}
            {!!app.error && (
              <Card style={{ borderColor: colors.danger, padding: 16 }}>
                <Row
                  style={{ justifyContent: "space-between", flexWrap: "wrap" }}
                >
                  <Label style={{ color: colors.danger }}>
                    {(app.t[app.error as keyof typeof app.t] as string) ??
                      app.t.error}
                  </Label>
                  <Button
                    title="×"
                    compact
                    variant="ghost"
                    onPress={() => app.setError("")}
                  />
                </Row>
              </Card>
            )}
            {app.state.conflicts.map((c) => (
              <Card
                key={c.operation.operationId}
                style={{ borderColor: colors.lime }}
              >
                <Label>{app.t.conflict}</Label>
                <Label small muted>
                  {c.operation.kind} · {c.operation.entityId.slice(0, 8)}
                </Label>
                <Row style={{ flexWrap: "wrap" }}>
                  <Button
                    title={app.t.localVersion}
                    onPress={() => app.resolve(c, "local")}
                  />
                  <Button
                    title={app.t.remoteVersion}
                    variant="secondary"
                    onPress={() => app.resolve(c, "remote")}
                  />
                </Row>
              </Card>
            ))}
            {children}
          </ScrollView>
          {!wide && (
            <View style={{ borderTopWidth: 1, borderColor: colors.line }}>
              <View style={{ flexDirection: "row", paddingVertical: 4 }}>
                {nav.map((n) => item(n, true))}
              </View>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
