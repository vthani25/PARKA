import { CheckIn, CheckInEntry, DoseLog, Reminder, Trackable } from '../types';
import { findLog } from './reminders';
import { atTime } from './time';

export const MIN_TRACKABLES = 5;
export const MAX_TRACKABLES = 10;

export const MEDS_ON_TIME_ID = 'meds_on_time';

/** Preset trackables. Generic goals only, change them in "Choose trackables". */
export const PRESET_TRACKABLES: Trackable[] = [
  { id: 'sleep', label: 'Sleep', kind: 'measured', unit: 'hours', goal: 8, step: 0.5 },
  { id: 'water', label: 'Water', kind: 'measured', unit: 'oz', goal: 64, step: 8 },
  { id: 'protein', label: 'Protein', kind: 'measured', unit: 'g', goal: 60, step: 5 },
  { id: 'cardio', label: 'Cardio', kind: 'measured', unit: 'minutes', goal: 30, step: 5 },
  { id: 'stretching', label: 'Stretching and balance', kind: 'measured', unit: 'minutes', goal: 15, step: 5 },
  { id: 'quiet', label: 'Quiet time', kind: 'measured', unit: 'minutes', goal: 20, step: 5 },
  { id: 'brain', label: 'Brain games', kind: 'measured', unit: 'minutes', goal: 15, step: 5 },
  { id: 'bowel', label: 'Bowel movement', kind: 'felt' },
  { id: 'attitude', label: 'Attitude', kind: 'felt' },
  { id: 'tremor', label: 'Tremor', kind: 'felt' },
  { id: 'stiffness', label: 'Stiffness', kind: 'felt' },
  { id: 'freezing', label: 'Freezing', kind: 'felt' },
  { id: 'balance', label: 'Balance', kind: 'felt' },
  { id: 'fatigue', label: 'Fatigue', kind: 'felt' },
  { id: 'mood', label: 'Mood', kind: 'felt' },
  { id: MEDS_ON_TIME_ID, label: 'Medications on time', kind: 'auto' },
];

export const SCORE_WORDS = ['', 'Very bad', 'Bad', 'Okay', 'Good', 'Very good'];
export const SCORE_FACES = ['', '😣', '🙁', '😐', '🙂', '😄'];

/** Measured trackables: 100% of goal or more is 5, 80% is 4, 60% is 3, 40% is 2, below is 1. */
export function scoreAgainstGoal(value: number, goal: number): number {
  if (goal <= 0) return 5;
  const pct = value / goal;
  if (pct >= 1) return 5;
  if (pct >= 0.8) return 4;
  if (pct >= 0.6) return 3;
  if (pct >= 0.4) return 2;
  return 1;
}

export type MedsOnTime = { onTime: number; total: number; score: number };

/**
 * Medications on time, from the dose log. Counts only doses already due.
 * All within 5 minutes is 5, all within 15 minutes is 4, then one point less for
 * each dose more than 15 minutes late or missed (lowest 1).
 */
export function medsOnTimeScore(reminders: Reminder[], logs: DoseLog[], day: string, now: Date): MedsOnTime | undefined {
  const due = reminders.filter((r) => atTime(day, r.time).getTime() <= now.getTime());
  if (due.length === 0) return undefined;

  let within5 = 0;
  let within15 = 0;
  let lateOrMissed = 0;
  for (const r of due) {
    const log = findLog(logs, day, r);
    const minutesLate = log ? Math.abs(log.loggedAt - atTime(day, log.scheduledTime).getTime()) / 60000 : Infinity;
    if (minutesLate <= 5) within5++;
    if (minutesLate <= 15) within15++;
    else lateOrMissed++;
  }

  let score: number;
  if (within5 === due.length) score = 5;
  else if (within15 === due.length) score = 4;
  else score = Math.max(1, 4 - lateOrMissed);
  return { onTime: within15, total: due.length, score };
}

/** Day score out of 100: average of the answered trackable scores, times 20. Skipped items don't count. */
export function dayScore(entries: CheckInEntry[]): number {
  if (entries.length === 0) return 0;
  const avg = entries.reduce((sum, e) => sum + e.score, 0) / entries.length;
  return Math.round(avg * 20);
}

/** Hours (0..23) when the band logged a metronome start today, to pre-highlight "When did you feel off?". */
export function hoursFromLongPresses(timestamps: number[], day: string): number[] {
  const start = atTime(day, '00:00').getTime();
  const end = start + 24 * 3600 * 1000;
  const hours = timestamps.filter((t) => t >= start && t < end).map((t) => new Date(t).getHours());
  return [...new Set(hours)].sort((a, b) => a - b);
}

/** "Your best: 92. Your average: 74." Neutral facts, no advice. */
export function compareToHistory(today: CheckIn, history: CheckIn[]): string | undefined {
  const others = history.filter((c) => c.date !== today.date);
  if (others.length === 0) return 'This is your first check-in.';
  const best = Math.max(...others.map((c) => c.dayScore));
  const avg = Math.round(others.reduce((s, c) => s + c.dayScore, 0) / others.length);
  return `Your best so far: ${best}. Your average: ${avg}.`;
}

export function offHoursByTimeOfDay(checkIns: CheckIn[]): { label: string; count: number }[] {
  const buckets = [
    { label: 'Morning (6 AM to noon)', from: 6, to: 12, count: 0 },
    { label: 'Afternoon (noon to 5 PM)', from: 12, to: 17, count: 0 },
    { label: 'Evening (5 PM to 10 PM)', from: 17, to: 23, count: 0 },
  ];
  for (const c of checkIns) for (const h of c.offHours) for (const b of buckets) if (h >= b.from && h < b.to) b.count++;
  return buckets.map(({ label, count }) => ({ label, count }));
}

