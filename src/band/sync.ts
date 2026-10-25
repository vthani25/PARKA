// What the app does each time the band connects.
//
//   1. Ask the band for its status and the events it stored in flash while disconnected.
//   2. Compare the band's RTC clock with the phone. Fix event timestamps if the clock was off.
//   3. If the clock is off by more than 30 seconds, set it to the phone's time.
//   4. Acknowledge, so the band can clear its flash.
//   5. Send anything waiting: today's reminder times, metronome tempo, vibration length.

import { BandMessage, decode, encode, MessageType } from './protocol';

/** One request to the band, and the frames it sends back. */
export interface BandLink {
  request(frame: Uint8Array): Promise<Uint8Array[]>;
}

export type BandEvent = { type: 'dose_press' | 'long_press'; timestamp: number }; // timestamp in epoch ms

export type PendingUpdates = { reminders?: string[]; tempo?: number; vibrateSeconds?: number };

export type SyncResult = {
  battery: number;
  clockOffsetSeconds: number; // band clock minus phone clock, before correction
  clockCorrected: boolean;
  events: BandEvent[]; // new events only, timestamps in phone time
  sent: BandMessage['type'][];
};

export const MAX_CLOCK_DRIFT_SECONDS = 30;

export async function syncWithBand(
  link: BandLink,
  pending: PendingUpdates,
  alreadySeen: Set<string>,
  now: () => number = Date.now,
): Promise<SyncResult> {
  const sent: BandMessage['type'][] = [];
  const ask = async (message: BandMessage) => {
    sent.push(message.type);
    return (await link.request(encode(message))).map(decode);
  };

  // 1. Status plus stored events.
  const replies = await ask({ type: 'request_events' });
  const status = replies.find((m) => m.type === 'status');
  if (!status || status.type !== 'status') throw new Error('Band did not report its status');

  // 2. How far off is the band's clock? Convert stored events to phone time, skipping duplicates.
  const phoneSeconds = Math.floor(now() / 1000);
  const clockOffsetSeconds = status.bandTime - phoneSeconds;
  const events: BandEvent[] = [];
  for (const message of replies) {
    if (message.type !== 'dose_press' && message.type !== 'long_press') continue;
    const event = { type: message.type, timestamp: toPhoneTime(message.timestamp, clockOffsetSeconds) };
    const key = eventKey(event);
    if (alreadySeen.has(key)) continue;
    alreadySeen.add(key);
    events.push(event);
  }

  // 3. Fix the band's clock if it drifted.
  const clockCorrected = Math.abs(clockOffsetSeconds) > MAX_CLOCK_DRIFT_SECONDS;
  if (clockCorrected) await ask({ type: 'set_time', time: phoneSeconds });

  // 4. Events are safe on the phone now; the band may clear its flash.
  await ask({ type: 'ack', of: MessageType.REQUEST_EVENTS });

  // 5. Send what's waiting.
  if (pending.reminders) await ask({ type: 'set_reminders', times: pending.reminders });
  if (pending.tempo !== undefined) await ask({ type: 'set_tempo', bpm: pending.tempo });
  if (pending.vibrateSeconds !== undefined) await ask({ type: 'set_vibration', seconds: pending.vibrateSeconds });

  return { battery: status.battery, clockOffsetSeconds, clockCorrected, events, sent };
}

/** A band timestamp (seconds, band clock) converted to phone time (ms). */
export function toPhoneTime(bandSeconds: number, clockOffsetSeconds: number): number {
  return (bandSeconds - clockOffsetSeconds) * 1000;
}

export function eventKey(event: BandEvent): string {
  return `${event.type}:${Math.round(event.timestamp / 1000)}`;
}
