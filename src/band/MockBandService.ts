// MOCK: simulated wristband. No Bluetooth is used. SimulatedBand behaves like the band's
// firmware (RTC clock, flash storage, button presses) and speaks the real byte protocol,
// so protocol.ts and sync.ts run exactly as they would with real hardware.

import { BandEventType, BandService, BandStatus } from './BandService';
import { BandMessage, decode, encode, toHex } from './protocol';
import { BandLink, eventKey, PendingUpdates, syncWithBand, toPhoneTime } from './sync';

export type FrameLogLine = { at: number; direction: 'to band' | 'from band' | 'note'; text: string };

/** MOCK: the band's side of the conversation. */
class SimulatedBand {
  connected = false;
  clockSkewSeconds = 0; // how far the band's RTC is from the phone
  battery = 87;
  flash: BandMessage[] = []; // events stored while disconnected
  reminders: string[] = [];
  tempo = 70;
  vibrateSeconds = 10;
  pushLive: (frame: Uint8Array) => void = () => {};

  now(): number {
    return Math.floor(Date.now() / 1000) + this.clockSkewSeconds;
  }

  /** Handle one frame from the app and return the band's reply frames. */
  handle(frame: Uint8Array): Uint8Array[] {
    const message = decode(frame);
    switch (message.type) {
      case 'request_events':
        return [
          encode({ type: 'status', battery: this.battery, bandTime: this.now(), storedEvents: this.flash.length }),
          ...this.flash.map(encode),
        ];
      case 'set_time':
        this.clockSkewSeconds = message.time - Math.floor(Date.now() / 1000);
        break;
      case 'ack':
        this.flash = [];
        break;
      case 'set_reminders':
        this.reminders = message.times;
        break;
      case 'set_tempo':
        this.tempo = message.bpm;
        break;
      case 'set_vibration':
        this.vibrateSeconds = message.seconds;
        break;
    }
    return [encode({ type: 'ack', of: frame[1] })];
  }

  /** A button press: sent right away if connected, otherwise saved to flash with an RTC timestamp. */
  press(type: BandEventType, bandTime = this.now()) {
    const message: BandMessage = { type, timestamp: bandTime };
    if (this.connected) this.pushLive(encode(message));
    else this.flash.push(message);
  }
}

export class MockBandService implements BandService {
  readonly simulated = true;
  private band = new SimulatedBand();
  private eventListeners: ((e: { type: BandEventType; timestamp: number }) => void)[] = [];
  private statusListeners = new Set<() => void>();
  private logListeners = new Set<() => void>();
  private seen = new Set<string>();
  private clockOffsetSeconds = 0;
  private lastSync?: Date;
  private pending: PendingUpdates = {};
  log: FrameLogLine[] = [];

  private link: BandLink = {
    request: async (frame) => {
      this.addLog('to band', frame);
      const replies = this.band.handle(frame);
      replies.forEach((r) => this.addLog('from band', r));
      return replies;
    },
  };

  constructor() {
    // Live presses while connected.
    this.band.pushLive = (frame) => {
      this.addLog('from band', frame);
      const message = decode(frame);
      if (message.type === 'dose_press' || message.type === 'long_press') {
        this.emit({ type: message.type, timestamp: toPhoneTime(message.timestamp, this.clockOffsetSeconds) });
      }
    };
  }

  onEvent(cb: (e: { type: BandEventType; timestamp: number }) => void) {
    this.eventListeners.push(cb);
  }

  onStatusChange(cb: () => void) {
    this.statusListeners.add(cb);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  onLogChange(cb: () => void) {
    this.logListeners.add(cb);
    return () => {
      this.logListeners.delete(cb);
    };
  }

  status(): BandStatus {
    return { connected: this.band.connected, lastSync: this.lastSync, battery: this.band.connected ? this.band.battery : undefined };
  }

  /** Reminder times for the band's RTC. If disconnected, they are sent on reconnect. */
  async setReminders(times: string[]) {
    if (!this.band.connected) {
      this.pending.reminders = times;
      return;
    }
    await this.link.request(encode({ type: 'set_reminders', times }));
    this.markSynced();
  }

  async setMetronomeTempo(bpm: number) {
    if (!this.band.connected) {
      this.pending.tempo = bpm;
      return;
    }
    await this.link.request(encode({ type: 'set_tempo', bpm }));
    this.markSynced();
  }

  async setVibrationSeconds(seconds: number) {
    if (!this.band.connected) {
      this.pending.vibrateSeconds = seconds;
      return;
    }
    await this.link.request(encode({ type: 'set_vibration', seconds }));
  }

  /** Connect and run a full sync (sync.ts). */
  async connect() {
    this.band.connected = true;
    this.note('Connected to simulated band');
    const result = await syncWithBand(this.link, this.pending, this.seen);
    this.pending = {};
    this.clockOffsetSeconds = result.clockCorrected ? 0 : result.clockOffsetSeconds;
    if (result.clockCorrected) this.note(`Band clock was ${result.clockOffsetSeconds} s off. Clock reset.`);
    if (result.events.length) this.note(`${result.events.length} stored events received`);
    this.markSynced();
    result.events.forEach((e) => this.emit(e));
  }

  disconnect() {
    this.band.connected = false;
    this.note('Disconnected');
    this.statusListeners.forEach((cb) => cb());
  }

  // ---- Debug panel (Settings, long press the version number) ----

  simulateShortPress() {
    this.band.press('dose_press');
  }

  simulateLongPress() {
    this.band.press('long_press');
  }

  /** Disconnect, store 3 events on the band (a long press, a dose press, a long press), then reconnect. */
  async reconnectWithStoredEvents() {
    this.disconnect();
    const now = this.band.now();
    this.band.press('long_press', now - 50 * 60);
    this.band.press('dose_press', now - 30 * 60);
    this.band.press('long_press', now - 10 * 60);
    this.note('Band stored 3 events while disconnected');
    await this.connect();
  }

  skewClock(seconds: number) {
    this.band.clockSkewSeconds += seconds;
    this.note(`Band clock moved ${seconds} s ahead (fixed on next connect)`);
  }

  bandState() {
    const { reminders, tempo, vibrateSeconds, clockSkewSeconds } = this.band;
    return { reminders, tempo, vibrateSeconds, clockSkewSeconds };
  }

  private emit(e: { type: BandEventType; timestamp: number }) {
    const key = eventKey(e);
    this.seen.add(key);
    this.eventListeners.forEach((cb) => cb(e));
  }

  private markSynced() {
    this.lastSync = new Date();
    this.statusListeners.forEach((cb) => cb());
  }

  private addLog(direction: 'to band' | 'from band', frame: Uint8Array) {
    let text = toHex(frame);
    try {
      text = `${decode(frame).type}  [${text}]`;
    } catch {
      // keep raw hex
    }
    this.pushLog({ at: Date.now(), direction, text });
  }

  private note(text: string) {
    this.pushLog({ at: Date.now(), direction: 'note', text });
  }

  private pushLog(line: FrameLogLine) {
    this.log = [line, ...this.log].slice(0, 60);
    this.logListeners.forEach((cb) => cb());
  }
}
