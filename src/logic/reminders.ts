import { DoseLog, Reminder, Schedule } from '../types';
import { fromMinutes, MINUTES_PER_DAY, toMinutes } from './time';

/** A dose more than this many minutes late, and not logged, counts as missed. */
export const MISSED_AFTER_MINUTES = 60;

/** Today's reminders from the saved schedule, at the usual times (the safety fallback). */
export function defaultReminders(schedules: Schedule[]): Reminder[] {
  return schedules
    .flatMap((s) =>
      s.times.map((t) => ({ medicationId: s.medicationId, usualTime: t.time, time: t.time, dose: t.dose, status: 'pending' as const })),
    )
    .sort(byTime);
}

/**
 * "I'm awake": move today's reminders so the first dose is at wake time (plus an offset).
 *
 * Every dose moves by the same amount, so the gaps between doses stay exactly as the
 * doctor set them. Example: usual doses at 8:00, 12:00 and 16:00, awake at 7:00 ->
 * doses at 7:00, 11:00 and 15:00.
 *
 * @param schedules     the saved medication schedules
 * @param awakeAt       wake time today, "HH:mm"
 * @param offsetMinutes minutes between waking and the first dose (default 0)
 */
export function recalculateReminders(schedules: Schedule[], awakeAt: string, offsetMinutes = 0): Reminder[] {
  const usual = defaultReminders(schedules);
  if (usual.length === 0) return [];

  // 1. The first dose of a normal day.
  const firstUsual = toMinutes(usual[0].usualTime);

  // 2. Today the first dose is due at wake time plus the offset.
  const firstToday = toMinutes(awakeAt) + offsetMinutes;

  // 3. Shift every dose by the same amount. Doses can't move past the end of the day.
  const shift = firstToday - firstUsual;
  return usual.map((r) => {
    const moved = Math.min(Math.max(toMinutes(r.usualTime) + shift, 0), MINUTES_PER_DAY - 1);
    return { ...r, time: fromMinutes(moved) };
  });
}

/** Rebuild today's reminders after a schedule change, keeping doses already taken. */
export function rebuildReminders(
  schedules: Schedule[],
  previous: Reminder[],
  awakeAt?: string,
  offsetMinutes = 0,
): Reminder[] {
  const fresh = awakeAt ? recalculateReminders(schedules, awakeAt, offsetMinutes) : defaultReminders(schedules);
  return fresh.map((r) => {
    const old = previous.find((p) => p.medicationId === r.medicationId && p.usualTime === r.usualTime);
    return old?.status === 'taken' ? { ...r, status: 'taken' } : r;
  });
}

export type DisplayStatus = 'taken' | 'due' | 'next' | 'upcoming' | 'missed';

/** Status shown to the person: Taken, Due now, Next, Upcoming, or Missed. */
export function displayStatus(reminder: Reminder, all: Reminder[], nowTime: string): DisplayStatus {
  if (reminder.status === 'taken') return 'taken';
  const now = toMinutes(nowTime);
  const due = toMinutes(reminder.time);
  if (now > due + MISSED_AFTER_MINUTES) return 'missed';
  if (now >= due) return 'due';
  const next = nextReminder(all, nowTime);
  return next && next.time === reminder.time ? 'next' : 'upcoming';
}

/** The next dose the person should take: overdue (not yet missed) first, then the soonest upcoming. */
export function nextReminder(reminders: Reminder[], nowTime: string): Reminder | undefined {
  const now = toMinutes(nowTime);
  return reminders
    .filter((r) => r.status === 'pending' && now <= toMinutes(r.time) + MISSED_AFTER_MINUTES)
    .sort(byTime)[0];
}

/**
 * A band press means "I just took my dose". It marks the pending time slot closest to
 * the press (all medications in that slot, since they are taken together).
 */
export function nearestPendingTime(reminders: Reminder[], nowTime: string): string | undefined {
  const now = toMinutes(nowTime);
  let best: Reminder | undefined;
  for (const r of reminders) {
    if (r.status !== 'pending') continue;
    if (!best || Math.abs(toMinutes(r.time) - now) < Math.abs(toMinutes(best.time) - now)) best = r;
  }
  return best?.time;
}

/** The dose log entry for one of today's reminders, if it was taken. */
export function findLog(logs: DoseLog[], date: string, r: Reminder): DoseLog | undefined {
  return logs.find(
    (l) => l.date === date && l.medicationId === r.medicationId && (l.usualTime ? l.usualTime === r.usualTime : l.scheduledTime === r.time),
  );
}

export function byTime(a: { time: string }, b: { time: string }): number {
  return toMinutes(a.time) - toMinutes(b.time);
}
