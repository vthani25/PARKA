// Local notifications: the morning "I'm awake" notification and dose reminders.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { defaultReminders } from '../logic/reminders';
import { addDays, atTime, formatDose, formatTime } from '../logic/time';
import { medicationName, useApp } from '../state/store';

export const WAKE_CHANNEL = 'wake';
export const DOSE_CHANNEL = 'doses';
export const WAKE_CATEGORY = 'wake';
export const DOSE_CATEGORY = 'dose';
export const ACTION_AWAKE = 'awake';
export const ACTION_TOOK_DOSE = 'took-dose';
const WAKE_ID = 'wake-daily';
const DOSE_PREFIX = 'dose-';
const DAYS_AHEAD = 7; // fallback reminders are scheduled a week ahead

export async function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(WAKE_CHANNEL, {
    name: 'Good morning',
    description: "Morning notification to set today's reminders",
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync(DOSE_CHANNEL, {
    name: 'Dose reminders',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 1000, 500, 1000, 500, 1000],
  });

  // One large action on each. They run without opening the app (see backgroundTask.ts).
  await Notifications.setNotificationCategoryAsync(WAKE_CATEGORY, [
    { identifier: ACTION_AWAKE, buttonTitle: "I'm awake", options: { opensAppToForeground: false } },
  ]);
  await Notifications.setNotificationCategoryAsync(DOSE_CATEGORY, [
    { identifier: ACTION_TOOK_DOSE, buttonTitle: 'I took it', options: { opensAppToForeground: false } },
  ]);
}

export type PermissionResult = 'granted' | 'denied';

export async function requestNotificationPermission(): Promise<PermissionResult> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

export async function hasExactAlarmPermission(): Promise<boolean> {
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return true; // older Android versions don't need it
  }
}

export async function requestExactAlarmPermission(): Promise<PermissionResult> {
  if (await hasExactAlarmPermission()) return 'granted';
  try {
    const result = await Notifications.requestExactAlarmPermissionsAsync();
    return result.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

const delivery = async (): Promise<'alarmClock' | 'bestEffort'> => ((await hasExactAlarmPermission()) ? 'alarmClock' : 'bestEffort');

function wakeContent(name: string): Notifications.NotificationContentInput {
  return {
    title: `Good morning, ${name}`,
    body: "Tap when you're awake and PARKA will set today's reminders.",
    categoryIdentifier: WAKE_CATEGORY,
    data: { kind: 'wake' },
    sticky: false,
    autoDismiss: false,
  };
}

/** The daily "I'm awake" notification at the person's wake notification time. */
export async function scheduleWakeNotification() {
  const { settings, profile } = useApp.getState();
  await Notifications.cancelScheduledNotificationAsync(WAKE_ID).catch(() => {});
  const [hour, minute] = settings.wakeNotificationTime.split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    identifier: WAKE_ID,
    content: wakeContent(profile?.name ?? 'there'),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: WAKE_CHANNEL },
  });
}

/** Debug button for filming: show the morning notification now. */
export async function sendWakeNotificationNow() {
  const name = useApp.getState().profile?.name ?? 'there';
  await Notifications.scheduleNotificationAsync({ content: wakeContent(name), trigger: { channelId: WAKE_CHANNEL } });
}

/**
 * Schedule dose reminders: today's remaining reminders (moved by "I'm awake" if tapped), plus
 * the default schedule for the next days. If "I'm awake" is never tapped, the defaults still fire.
 */
export async function scheduleDoseNotifications() {
  const { day, schedules } = useApp.getState();
  const kind = await delivery();

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => n.identifier.startsWith(DOSE_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const now = Date.now();
  const plan: { date: string; time: string; lines: string[] }[] = [];
  const addSlot = (date: string, reminders: { time: string; medicationId: string; dose: number }[]) => {
    const byTime = new Map<string, string[]>();
    for (const r of reminders) byTime.set(r.time, [...(byTime.get(r.time) ?? []), `${medicationName(r.medicationId)}: ${formatDose(r.dose)}`]);
    byTime.forEach((lines, time) => plan.push({ date, time, lines }));
  };
  addSlot(day.date, day.reminders.filter((r) => r.status === 'pending'));
  for (let i = 1; i <= DAYS_AHEAD; i++) addSlot(addDays(day.date, i), defaultReminders(schedules));

  for (const slot of plan) {
    const when = atTime(slot.date, slot.time);
    if (when.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${DOSE_PREFIX}${slot.date}-${slot.time}`,
      content: {
        title: `Time for your medication (${formatTime(slot.time)})`,
        body: slot.lines.join('\n'),
        categoryIdentifier: DOSE_CATEGORY,
        data: { kind: 'dose', date: slot.date, time: slot.time },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: DOSE_CHANNEL, delivery: kind } as Notifications.DateTriggerInput,
    });
  }
}

export async function cancelDoseNotification(date: string, time: string) {
  await Notifications.cancelScheduledNotificationAsync(`${DOSE_PREFIX}${date}-${time}`).catch(() => {});
}

export async function showMessage(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: { channelId: WAKE_CHANNEL } });
}
