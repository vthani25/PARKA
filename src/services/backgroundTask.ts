// Runs when a notification action button is tapped, even if the app is closed (Android).
// "I'm awake" recalculates today's reminders without opening the app.
// Imported from index.ts so the task is defined before anything else runs.

import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { loadStore } from '../state/store';
import { confirmAwake, logDoseSlot } from './actions';
import { ACTION_AWAKE, ACTION_TOOK_DOSE, showMessage } from './notifications';

export const NOTIFICATION_TASK = 'parka-notification-actions';

let lastHandled = '';

/** Handle an action button. Safe to call twice for the same tap (foreground listener + task). */
export async function handleNotificationAction(response: Notifications.NotificationResponse) {
  const key = `${response.notification.request.identifier}:${response.actionIdentifier}:${response.notification.date}`;
  if (key === lastHandled) return;
  lastHandled = key;

  await loadStore();
  const request = response.notification.request;
  const data = (request.content.data ?? {}) as { date?: string; time?: string };

  if (response.actionIdentifier === ACTION_AWAKE) {
    const message = await confirmAwake(new Date());
    await Notifications.dismissNotificationAsync(request.identifier).catch(() => {});
    await showMessage('PARKA', message);
  }

  if (response.actionIdentifier === ACTION_TOOK_DOSE && data.date && data.time) {
    await logDoseSlot(data.date, data.time);
    await Notifications.dismissNotificationAsync(request.identifier).catch(() => {});
  }
}

TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data, error }) => {
  if (error || !data || !('actionIdentifier' in data)) return;
  await handleNotificationAction(data as Notifications.NotificationResponse);
});

export async function registerNotificationTask() {
  try {
    await Notifications.registerTaskAsync(NOTIFICATION_TASK);
  } catch {
    // The app still works; the action will run when the app opens.
  }
}
