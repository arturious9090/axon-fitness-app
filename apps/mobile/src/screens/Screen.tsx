import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useApp } from "../lib/store";
import { Shell } from "../components/Shell";
import { colors } from "../components/ui";
import { Account } from "./Account";
export function Screen({ children }: { children: React.ReactNode }) {
  const app = useApp();
  if (!app.ready)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.lime} />
      </View>
    );
  return app.identity ? <Shell>{children}</Shell> : <Account />;
}
