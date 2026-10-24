import type { Settings } from "@axon/core";
export async function enableReminders() {
  return false;
}
export async function scheduleReminders(
  _settings: Pick<Settings, "language" | "reminders" | "reminderHour">,
  _days: number[],
) {}
export async function scheduleRest(
  _endsAt: number | null,
  _language: Settings["language"],
) {}
