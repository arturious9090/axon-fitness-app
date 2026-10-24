import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useApp } from "../lib/store";

export const colors = {
  bg: "#0b1210",
  panel: "#131e19",
  panel2: "#1c2a22",
  line: "#2a3930",
  text: "#f1f5ed",
  muted: "#98a99d",
  lime: "#d4f88a",
  danger: "#ffada3",
};
export function Icon({
  name,
  size = 20,
  color = colors.muted,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  size?: number;
  color?: string;
}) {
  return <Feather name={name} size={size} color={color} />;
}
export function Label({
  children,
  muted = false,
  small = false,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  small?: boolean;
  style?: object;
}) {
  return (
    <Text
      style={[
        {
          color: muted ? colors.muted : colors.text,
          fontSize: small ? 12 : 15,
          lineHeight: small ? 18 : 23,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Title({
  children,
  small = false,
}: {
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.text,
        fontSize: small ? 21 : 34,
        fontWeight: "700",
        letterSpacing: -0.8,
        lineHeight: small ? 29 : 43,
      }}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[s.row, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
  compact = false,
}: {
  title: string;
  onPress: () => void | Promise<unknown>;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: React.ComponentProps<typeof Feather>["name"];
  disabled?: boolean;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const { setError } = useApp();
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={async () => {
        setBusy(true);
        try {
          await onPress();
        } catch {
          setError("error");
        } finally {
          setBusy(false);
        }
      }}
      style={({ pressed }) => [
        s.button,
        {
          paddingHorizontal: compact ? 12 : 18,
          backgroundColor: primary
            ? colors.lime
            : variant === "secondary"
              ? colors.panel2
              : "transparent",
          borderColor:
            variant === "danger"
              ? colors.danger
              : variant === "ghost"
                ? "transparent"
                : primary
                  ? colors.lime
                  : colors.line,
          opacity: disabled || busy ? 0.6 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          size={17}
          color={
            primary
              ? colors.bg
              : variant === "danger"
                ? colors.danger
                : colors.text
          }
        />
      )}
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: primary
            ? colors.bg
            : variant === "danger"
              ? colors.danger
              : colors.text,
        }}
      >
        {busy ? "…" : title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  ...props
}: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 7, flexShrink: 1 }}>
      {label && (
        <Label small muted>
          {label}
        </Label>
      )}
      <TextInput
        accessibilityLabel={label ?? props.placeholder}
        placeholderTextColor={colors.muted}
        {...props}
        style={[s.input, props.style]}
      />
    </View>
  );
}
export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.panel2,
        borderRadius: 20,
        paddingHorizontal: 11,
        paddingVertical: 4,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontSize: 11, color: colors.lime, fontWeight: "600" }}>
        {children}
      </Text>
    </View>
  );
}
export function Empty({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
      <Icon name="activity" size={32} color={colors.lime} />
      <Title small>{title}</Title>
      {subtitle && <Label muted>{subtitle}</Label>}
      {children}
    </Card>
  );
}
export function Confirm({
  title,
  description,
  onConfirm,
  buttonTitle,
  danger = false,
}: {
  title: string;
  description?: string;
  onConfirm: () => void | Promise<unknown>;
  buttonTitle?: string;
  danger?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const { t } = useApp();
  return (
    <>
      <Button
        title={buttonTitle ?? title}
        variant={danger ? "danger" : "secondary"}
        onPress={() => setVisible(true)}
      />
      <Dialog visible={visible} onClose={() => setVisible(false)} title={title}>
        <Label muted>{description}</Label>
        <Row style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Button
            title={t.cancel}
            variant="ghost"
            onPress={() => setVisible(false)}
          />
          <Button
            title={danger ? t.yesDelete : t.done}
            variant={danger ? "danger" : "primary"}
            onPress={async () => {
              await onConfirm();
              setVisible(false);
            }}
          />
        </Row>
      </Dialog>
    </>
  );
}
export function Dialog({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View
          accessibilityViewIsModal
          style={[s.card, { maxWidth: 560, width: "100%", gap: 22 }]}
        >
          <Row style={{ justifyContent: "space-between" }}>
            <Title small>{title}</Title>
            <Button title="×" compact variant="ghost" onPress={onClose} />
          </Row>
          {children}
        </View>
      </View>
    </Modal>
  );
}
export const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  button: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 15,
  },
  overlay: {
    flex: 1,
    backgroundColor: "#000a",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
});
