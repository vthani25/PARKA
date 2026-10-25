// All app data, saved on the phone with AsyncStorage. No accounts, no backend.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { dayScore, MEDS_ON_TIME_ID, PRESET_TRACKABLES } from '../logic/checkin';
import { defaultReminders, nearestPendingTime, rebuildReminders } from '../logic/reminders';
import { dateKey, newId, timeOf } from '../logic/time';
import {
  CheckIn,
  DayState,
  DoseLog,
  HospitalCard,
  Medication,
  MetronomeStart,
  Profile,
  Recipient,
  Schedule,
  ScheduleTime,
  Settings,
  Trackable,
} from '../types';

export const DEFAULT_SETTINGS: Settings = {
  fontScale: 1,
  highContrast: false,
  voiceEnabled: true,
  metronomeTempo: 70,
  vibrateSeconds: 10,
  wakeNotificationTime: '07:00',
  wakeOffsetMinutes: 0,
  recipients: [],
};

export const EMPTY_HOSPITAL_CARD: HospitalCard = {
  patientName: '',
  careContact: { name: '', phone: '' },
  parkinsonsDoctor: { name: '', phone: '' },
  allergies: '',
  otherConditions: '',
  flags: {
    swallowing: false,
    balance: false,
    dbs: false,
    deliveryDevice: false,
    dizzy: false,
    confusion: false,
    hallucinations: false,
    dementia: false,
    dietary: false,
  },
};

type Data = {
  profile?: Profile;
  onboardingComplete: boolean;
  medications: Medication[];
  schedules: Schedule[];
  doseLogs: DoseLog[];
  day: DayState;
  trackables: Trackable[]; // chosen for the daily check-in (empty until chosen)
  customTrackables: Trackable[];
  checkIns: CheckIn[];
  metronomeStarts: MetronomeStart[];
  hospitalCard: HospitalCard;
  settings: Settings;
};

type Actions = {
  setProfile(profile: Profile): void;
  completeOnboarding(): void;
  updateSettings(patch: Partial<Settings>): void;
  addRecipient(r: Omit<Recipient, 'id'>): void;
  removeRecipient(id: string): void;

  /** Start a new day from the default schedule if the date changed (safety fallback). */
  ensureToday(now?: Date): DayState;
  /** "I'm awake": recalculate today's reminders from the wake time. */
  markAwake(at?: Date): DayState;
  saveMedication(med: Medication, times: ScheduleTime[]): void;
  deleteMedication(id: string): void;
  /** Log every pending dose in one time slot. Returns how many were logged. */
  logDoseSlot(time: string, source: DoseLog['source'], at?: Date): number;
  /** A band press: log the pending slot closest to the press time. */
  logNearestDose(source: DoseLog['source'], at?: Date): number;
  recordMetronomeStart(timestamp: number): void;

  setTrackables(chosen: Trackable[], custom: Trackable[]): void;
  saveCheckIn(checkIn: CheckIn): void;
  /** Add ratings, notes or off periods to a day's check-in, keeping what is already there. */
  mergeCheckIn(date: string, patch: Partial<Omit<CheckIn, 'id' | 'date' | 'dayScore'>>): void;
  saveHospitalCard(card: HospitalCard): void;

  loadSampleData(): void;
  resetAll(): void;
};

export type AppState = Data & Actions;

const initialData = (): Data => ({
  onboardingComplete: false,
  medications: [],
  schedules: [],
  doseLogs: [],
  day: { date: dateKey(new Date()), reminders: [] },
  trackables: [],
  customTrackables: [],
  checkIns: [],
  metronomeStarts: [],
  hospitalCard: EMPTY_HOSPITAL_CARD,
  settings: DEFAULT_SETTINGS,
});

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialData(),

      setProfile: (profile) =>
        set((s) => ({
          profile,
          hospitalCard: s.hospitalCard.patientName ? s.hospitalCard : { ...s.hospitalCard, patientName: profile.name },
        })),
      completeOnboarding: () => set({ onboardingComplete: true }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      addRecipient: (r) => set((s) => ({ settings: { ...s.settings, recipients: [...s.settings.recipients, { ...r, id: newId() }] } })),
      removeRecipient: (id) =>
        set((s) => ({ settings: { ...s.settings, recipients: s.settings.recipients.filter((r) => r.id !== id) } })),

      ensureToday: (now = new Date()) => {
        const today = dateKey(now);
        const { day, schedules } = get();
        if (day.date === today) return day;
        const fresh: DayState = { date: today, reminders: defaultReminders(schedules) };
        set({ day: fresh });
        return fresh;
      },

      markAwake: (at = new Date()) => {
        const day = get().ensureToday(at);
        const awakeAt = timeOf(at);
        const { schedules, settings } = get();
        const updated: DayState = { ...day, awakeAt, reminders: rebuildReminders(schedules, day.reminders, awakeAt, settings.wakeOffsetMinutes) };
        set({ day: updated });
        return updated;
      },

      saveMedication: (med, times) => {
        const sorted = [...times].sort((a, b) => a.time.localeCompare(b.time));
        const medications = get().medications.some((m) => m.id === med.id)
          ? get().medications.map((m) => (m.id === med.id ? med : m))
          : [...get().medications, med];
        const schedules = [...get().schedules.filter((s) => s.medicationId !== med.id), { medicationId: med.id, times: sorted }];
        const day = get().ensureToday();
        const reminders = rebuildReminders(schedules, day.reminders, day.awakeAt, get().settings.wakeOffsetMinutes);
        set({ medications, schedules, day: { ...day, reminders } });
      },

      deleteMedication: (id) => {
        const schedules = get().schedules.filter((s) => s.medicationId !== id);
        const day = get().ensureToday();
        set({
          medications: get().medications.filter((m) => m.id !== id),
          schedules,
          day: { ...day, reminders: day.reminders.filter((r) => r.medicationId !== id) },
        });
      },

      logDoseSlot: (time, source, at = new Date()) => {
        const day = get().ensureToday(at);
        const slot = day.reminders.filter((r) => r.time === time && r.status === 'pending');
        if (slot.length === 0) return 0;
        const logs: DoseLog[] = slot.map((r) => ({
          id: newId(),
          medicationId: r.medicationId,
          date: day.date,
          scheduledTime: r.time,
          usualTime: r.usualTime,
          loggedAt: at.getTime(),
          source,
        }));
        set({
          doseLogs: [...get().doseLogs, ...logs],
          day: { ...day, reminders: day.reminders.map((r) => (r.time === time && r.status === 'pending' ? { ...r, status: 'taken' } : r)) },
        });
        return logs.length;
      },

      logNearestDose: (source, at = new Date()) => {
        const day = get().ensureToday(at);
        const time = nearestPendingTime(day.reminders, timeOf(at));
        return time ? get().logDoseSlot(time, source, at) : 0;
      },

      recordMetronomeStart: (timestamp) => set((s) => ({ metronomeStarts: [...s.metronomeStarts, { timestamp, source: 'band' }] })),

      setTrackables: (chosen, custom) => set({ trackables: chosen, customTrackables: custom }),
      saveCheckIn: (checkIn) => set((s) => ({ checkIns: [...s.checkIns.filter((c) => c.date !== checkIn.date), checkIn] })),
      mergeCheckIn: (date, patch) =>
        set((s) => {
          const old = s.checkIns.find((c) => c.date === date) ?? { id: newId(), date, entries: [], offHours: [], dayScore: 0 };
          const merged = { ...old, ...patch };
          merged.dayScore = dayScore(merged.entries);
          return { checkIns: [...s.checkIns.filter((c) => c.date !== date), merged] };
        }),
      saveHospitalCard: (card) => set({ hospitalCard: card }),

      loadSampleData: () => set(sampleData(get())),
      resetAll: () => set(initialData()),
    }),
    {
      name: 'parka-data',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Load saved data. Needed in background tasks (the notification action runs without the app open). */
export async function loadStore() {
  if (!useApp.persist.hasHydrated()) await useApp.persist.rehydrate();
}

export function medicationName(id: string): string {
  return useApp.getState().medications.find((m) => m.id === id)?.name ?? 'Medication';
}

// ---- Sample data for demos (Settings > Load sample data). Generic, not real people. ----

function sampleData(current: Data): Partial<Data> {
  const levo: Medication = { id: 'sample-levo', name: 'Carbidopa/Levodopa', strength: '25/100 mg' };
  const prami: Medication = { id: 'sample-prami', name: 'Pramipexole', strength: '0.25 mg' };
  const schedules: Schedule[] = [
    { medicationId: levo.id, times: [{ time: '08:00', dose: 1 }, { time: '12:00', dose: 1 }, { time: '16:00', dose: 1 }, { time: '20:00', dose: 0.5 }] },
    { medicationId: prami.id, times: [{ time: '08:00', dose: 1 }] },
  ];
  const ids = ['sleep', 'water', 'cardio', 'stretching', 'tremor', 'stiffness', 'mood', MEDS_ON_TIME_ID];
  const trackables = PRESET_TRACKABLES.filter((t) => ids.includes(t.id));
  const today = new Date();
  const checkIns: CheckIn[] = [];
  const scores = [62, 70, 58, 74, 80, 68];
  for (let i = 6; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const score = scores[6 - i];
    const base = Math.round(score / 20);
    checkIns.push({
      id: newId(),
      date: dateKey(d),
      entries: trackables.map((t, k) => ({ trackableId: t.id, score: Math.min(5, Math.max(1, base + ((k + i) % 3) - 1)), source: t.kind === 'auto' ? 'auto' : 'entered' })),
      offHours: i % 2 === 0 ? [15, 16] : [10],
      overall: base,
      note: i === 3 ? 'Walked to the mailbox and back twice.' : undefined,
      dayScore: score,
    });
  }
  return {
    medications: [levo, prami],
    schedules,
    day: { date: dateKey(today), reminders: defaultReminders(schedules) },
    doseLogs: current.doseLogs.filter((l) => l.date !== dateKey(today)),
    trackables,
    checkIns,
    hospitalCard: {
      ...current.hospitalCard,
      patientName: current.profile?.name ?? 'Sample Patient',
      diagnosedYear: '2015',
      careContact: { name: 'Sample Caregiver', phone: '555-0100' },
      parkinsonsDoctor: { name: 'Dr. Sample Neurologist', phone: '555-0101' },
      allergies: 'Penicillin',
      otherConditions: 'High blood pressure',
    },
  };
}
