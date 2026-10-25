// Small helpers for "HH:mm" times and local dates.

export const MINUTES_PER_DAY = 24 * 60;

/** "08:30" -> 510 */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 510 -> "08:30" */
export function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "13:05" -> "1:05 PM" */
export function formatTime(time: string): string {
  const total = toMinutes(time);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Hour number 0..23 -> "6 AM" */
export function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${suffix}`;
}

/** Local "HH:mm" of a Date. */
export function timeOf(date: Date): string {
  return fromMinutes(date.getHours() * 60 + date.getMinutes());
}

/** Local "YYYY-MM-DD" of a Date. */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Date object for a "YYYY-MM-DD" day at an "HH:mm" time, local time. */
export function atTime(day: string, time: string): Date {
  const [y, mo, d] = day.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

export function addDays(day: string, days: number): string {
  const date = atTime(day, '12:00');
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

/** "Saturday, October 24" */
export function formatDay(day: string): string {
  return atTime(day, '12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** "1 tablet", "1.5 tablets", "½ tablet" */
export function formatDose(dose: number): string {
  const amount = dose === 0.5 ? '½' : String(dose);
  return `${amount} ${dose <= 1 ? 'tablet' : 'tablets'}`;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
