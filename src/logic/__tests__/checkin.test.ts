import { DoseLog, Reminder } from '../../types';
import { dayScore, hoursFromLongPresses, medsOnTimeScore, scoreAgainstGoal } from '../checkin';
import { atTime } from '../time';

const DAY = '2026-10-24';

describe('scoreAgainstGoal', () => {
  it.each([
    [8, 8, 5],
    [10, 8, 5],
    [6.4, 8, 4],
    [5, 8, 3],
    [3.2, 8, 2],
    [1, 8, 1],
  ])('%s of goal %s scores %s', (value, goal, score) => {
    expect(scoreAgainstGoal(value, goal)).toBe(score);
  });
});

describe('medsOnTimeScore', () => {
  const reminders: Reminder[] = ['08:00', '12:00', '16:00'].map((t) => ({ medicationId: 'm', usualTime: t, time: t, dose: 1, status: 'pending' }));
  const log = (time: string, minutesLate: number): DoseLog => ({
    id: time,
    medicationId: 'm',
    date: DAY,
    scheduledTime: time,
    loggedAt: atTime(DAY, time).getTime() + minutesLate * 60000,
    source: 'band',
  });
  const evening = atTime(DAY, '20:00');

  it('all within 5 minutes is 5', () => {
    expect(medsOnTimeScore(reminders, [log('08:00', 2), log('12:00', 0), log('16:00', 4)], DAY, evening)).toEqual({ onTime: 3, total: 3, score: 5 });
  });

  it('all within 15 minutes is 4', () => {
    expect(medsOnTimeScore(reminders, [log('08:00', 12), log('12:00', 0), log('16:00', 4)], DAY, evening)?.score).toBe(4);
  });

  it('loses a point per late or missed dose', () => {
    expect(medsOnTimeScore(reminders, [log('08:00', 40), log('12:00', 0)], DAY, evening)).toEqual({ onTime: 1, total: 3, score: 2 });
  });

  it('only counts doses already due', () => {
    expect(medsOnTimeScore(reminders, [log('08:00', 0)], DAY, atTime(DAY, '10:00'))).toEqual({ onTime: 1, total: 1, score: 5 });
  });
});

describe('dayScore', () => {
  it('is the average score times 20', () => {
    const entries = [5, 4, 3, 4].map((score, i) => ({ trackableId: String(i), score, source: 'entered' as const }));
    expect(dayScore(entries)).toBe(80);
  });
});

describe('hoursFromLongPresses', () => {
  it('returns each hour with a metronome start once', () => {
    const t = (time: string) => atTime(DAY, time).getTime();
    const yesterday = atTime('2026-10-23', '11:00').getTime();
    expect(hoursFromLongPresses([t('09:10'), t('09:40'), t('15:05'), yesterday], DAY)).toEqual([9, 15]);
  });
});
