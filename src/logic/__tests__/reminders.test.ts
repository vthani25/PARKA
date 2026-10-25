import { Schedule } from '../../types';
import { defaultReminders, displayStatus, nearestPendingTime, nextReminder, rebuildReminders, recalculateReminders } from '../reminders';

const levodopa: Schedule = {
  medicationId: 'levo',
  times: [
    { time: '08:00', dose: 1 },
    { time: '12:00', dose: 1 },
    { time: '16:00', dose: 1.5 },
  ],
};
const evening: Schedule = { medicationId: 'night', times: [{ time: '21:00', dose: 0.5 }] };

const times = (rs: { time: string }[]) => rs.map((r) => r.time);

describe('recalculateReminders', () => {
  it('moves the first dose to wake time and keeps the gaps', () => {
    expect(times(recalculateReminders([levodopa], '07:00'))).toEqual(['07:00', '11:00', '15:00']);
  });

  it('works when waking later than usual', () => {
    expect(times(recalculateReminders([levodopa], '09:30'))).toEqual(['09:30', '13:30', '17:30']);
  });

  it('keeps gaps across different medications', () => {
    const result = recalculateReminders([evening, levodopa], '06:45');
    expect(times(result)).toEqual(['06:45', '10:45', '14:45', '19:45']);
    expect(result[3].medicationId).toBe('night');
  });

  it('adds the wake offset to the first dose', () => {
    expect(times(recalculateReminders([levodopa], '07:00', 30))).toEqual(['07:30', '11:30', '15:30']);
  });

  it('keeps dose amounts and usual times', () => {
    const result = recalculateReminders([levodopa], '07:00');
    expect(result.map((r) => r.dose)).toEqual([1, 1, 1.5]);
    expect(result.map((r) => r.usualTime)).toEqual(['08:00', '12:00', '16:00']);
    expect(result.every((r) => r.status === 'pending')).toBe(true);
  });

  it('never moves a dose past the end of the day', () => {
    expect(times(recalculateReminders([evening, levodopa], '11:00'))).toEqual(['11:00', '15:00', '19:00', '23:59']);
  });

  it('returns nothing when there is no schedule', () => {
    expect(recalculateReminders([], '07:00')).toEqual([]);
  });

  it('waking at the usual time changes nothing', () => {
    expect(times(recalculateReminders([levodopa], '08:00'))).toEqual(times(defaultReminders([levodopa])));
  });
});

describe('rebuildReminders', () => {
  it('keeps doses already taken after a schedule change', () => {
    const today = recalculateReminders([levodopa], '07:00');
    today[0].status = 'taken';
    const rebuilt = rebuildReminders([levodopa, evening], today, '07:00');
    expect(rebuilt.map((r) => r.status)).toEqual(['taken', 'pending', 'pending', 'pending']);
  });
});

describe('statuses', () => {
  const today = defaultReminders([levodopa]);

  it('finds the next dose', () => {
    expect(nextReminder(today, '09:30')?.time).toBe('12:00');
    expect(nextReminder(today, '08:20')?.time).toBe('08:00'); // overdue but not missed
  });

  it('labels due, missed, next and upcoming', () => {
    expect(displayStatus(today[0], today, '08:10')).toBe('due');
    expect(displayStatus(today[0], today, '09:30')).toBe('missed');
    expect(displayStatus(today[1], today, '09:30')).toBe('next');
    expect(displayStatus(today[2], today, '09:30')).toBe('upcoming');
  });

  it('band press picks the closest pending dose', () => {
    expect(nearestPendingTime(today, '11:40')).toBe('12:00');
    expect(nearestPendingTime(today, '08:05')).toBe('08:00');
  });
});
