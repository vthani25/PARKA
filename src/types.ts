// Data model (see the app spec, section 3). Everything is stored on the phone only.

export type Profile = { name: string; phone?: string };

export type Recipient = { id: string; name: string; phone: string; relationship?: string };

export type Medication = { id: string; name: string; strength?: string; notes?: string; ownSupply?: boolean };

/** One time slot in a medication's daily schedule. `dose` is in tablets, half steps allowed. */
export type ScheduleTime = { time: string; dose: number }; // time is "HH:mm"

export type Schedule = { medicationId: string; times: ScheduleTime[] };

export type DoseLog = {
  id: string;
  medicationId: string;
  date: string; // "YYYY-MM-DD"
  scheduledTime: string; // "HH:mm" (today's reminder time when it was logged)
  usualTime?: string; // "HH:mm" slot in the saved schedule, stays the same if "I'm awake" moves the time
  loggedAt: number; // epoch ms
  source: 'band' | 'app';
};

export type ReminderStatus = 'pending' | 'taken';

export type Reminder = {
  medicationId: string;
  usualTime: string; // time in the saved schedule
  time: string; // time for today (moved by "I'm awake")
  dose: number;
  status: ReminderStatus;
};

export type DayState = { date: string; awakeAt?: string; reminders: Reminder[] };

export type TrackableKind = 'measured' | 'felt' | 'auto';

export type Trackable = { id: string; label: string; kind: TrackableKind; unit?: string; goal?: number; step?: number };

export type CheckInEntry = { trackableId: string; value?: number; score: number; source: 'entered' | 'auto' };

export type CheckIn = {
  id: string;
  date: string;
  entries: CheckInEntry[];
  offHours: number[];
  overall?: number;
  note?: string;
  dayScore: number; // 0..100
};

export type HospitalFlags = {
  swallowing: boolean;
  balance: boolean;
  dbs: boolean;
  deliveryDevice: boolean;
  dizzy: boolean;
  confusion: boolean;
  hallucinations: boolean;
  dementia: boolean;
  dietary: boolean;
};

export type Contact = { name: string; phone: string };

export type HospitalCard = {
  patientName: string;
  diagnosedYear?: string;
  homeAddress?: string;
  careContact: Contact;
  parkinsonsDoctor: Contact;
  primaryDoctor?: string;
  pharmacy?: string;
  allergies: string;
  otherConditions: string;
  flags: HospitalFlags;
};

export type FontScale = 1 | 1.2 | 1.4;

export type Settings = {
  fontScale: FontScale;
  highContrast: boolean;
  voiceEnabled: boolean;
  metronomeTempo: number; // beats per minute
  vibrateSeconds: number;
  wakeNotificationTime: string; // "HH:mm"
  wakeOffsetMinutes: number; // first dose = wake time + this
  recipients: Recipient[];
};

export type MetronomeStart = { timestamp: number; source: 'band' };
