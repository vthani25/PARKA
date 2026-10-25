// Actions shared by buttons, voice commands and notification actions.

import { band, todaysBandTimes } from '../band';
import { nextReminder } from '../logic/reminders';
import { formatTime, timeOf } from '../logic/time';
import { useApp } from '../state/store';
import { cancelDoseNotification, scheduleDoseNotifications } from './notifications';

/** "I'm awake": recalculate today's reminders, reschedule notifications, update the band's RTC. */
export async function confirmAwake(at = new Date()): Promise<string> {
  const day = useApp.getState().markAwake(at);
  await scheduleDoseNotifications();
  await band.setReminders(todaysBandTimes()); // queued if the band is disconnected
  const first = nextReminder(day.reminders, timeOf(at));
  return first ? `Reminders set. First dose at ${formatTime(first.time)}.` : 'Reminders set.';
}

/** Log the dose closest to now (button, voice or band). Returns a sentence to show or speak. */
export async function logDoseNow(source: 'app' | 'band' = 'app'): Promise<string> {
  const state = useApp.getState();
  const day = state.ensureToday();
  const before = day.reminders.filter((r) => r.status === 'pending').map((r) => r.time);
  const count = state.logNearestDose(source);
  if (count === 0) return 'There is no dose to log right now.';
  const after = useApp.getState().day.reminders.filter((r) => r.status === 'pending').map((r) => r.time);
  const loggedTime = before.find((t) => !after.includes(t));
  if (loggedTime) await cancelDoseNotification(day.date, loggedTime);
  await band.setReminders(todaysBandTimes());
  return loggedTime ? `Dose logged for ${formatTime(loggedTime)}.` : 'Dose logged.';
}

/** Log one specific time slot (from a dose reminder's "I took it" button). */
export async function logDoseSlot(date: string, time: string) {
  const state = useApp.getState();
  const day = state.ensureToday();
  if (day.date !== date) return;
  state.logDoseSlot(time, 'app');
  await band.setReminders(todaysBandTimes());
}
