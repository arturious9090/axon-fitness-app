import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Settings } from "@axon/core";
import { dictionaries } from "./i18n";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
export async function enableReminders() {
  if (Platform.OS === "web") return false;
  await Notifications.setNotificationChannelAsync("training", {
    name: "Axon Fitness",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  return (await Notifications.requestPermissionsAsync()).granted;
}
export async function scheduleReminders(
  settings: Pick<Settings, "language" | "reminders" | "reminderHour">,
  days: number[],
) {
  if (Platform.OS === "web") return;
  for (const n of await Notifications.getAllScheduledNotificationsAsync())
    if (n.identifier.startsWith("axon-weekly-"))
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
  if (
    !settings.reminders ||
    !(await Notifications.getPermissionsAsync()).granted
  )
    return;
  const t = dictionaries[settings.language];
  for (const day of new Set(days))
    await Notifications.scheduleNotificationAsync({
      identifier: `axon-weekly-${day}`,
      content: { title: t.reminderTitle, body: t.reminderBody },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: day + 1,
        hour: settings.reminderHour,
        minute: 0,
        channelId: "training",
      },
    });
}
export async function scheduleRest(
  endsAt: number | null,
  language: Settings["language"],
) {
  if (Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync("axon-rest").catch(
    () => {},
  );
  if (
    endsAt &&
    endsAt > Date.now() &&
    (await Notifications.getPermissionsAsync()).granted
  )
    await Notifications.scheduleNotificationAsync({
      identifier: "axon-rest",
      content: { title: dictionaries[language].restReady },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(endsAt),
        channelId: "training",
      },
    });
}
