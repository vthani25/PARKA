import { useEffect, useState } from 'react';
import { useApp } from '../state/store';
import { BandStatus } from './BandService';
import { MockBandService } from './MockBandService';

// MOCK: the app uses the simulated band until real Bluetooth (BleBandService) is built.
export const band = new MockBandService();

let started = false;

/** Connect band events to app data. Called once when the app starts. */
export function startBand() {
  if (started) return;
  started = true;

  band.onEvent((e) => {
    const state = useApp.getState();
    if (e.type === 'dose_press') state.logNearestDose('band', new Date(e.timestamp));
    if (e.type === 'long_press') state.recordMetronomeStart(e.timestamp);
  });
}

/** Today's reminder times still to come, for the band's RTC alarms. */
export function todaysBandTimes(): string[] {
  const { day } = useApp.getState();
  return [...new Set(day.reminders.filter((r) => r.status === 'pending').map((r) => r.time))];
}

/** Re-renders when the band connects, disconnects or syncs. */
export function useBandStatus(): BandStatus {
  const [status, setStatus] = useState(band.status());
  useEffect(() => band.onStatusChange(() => setStatus(band.status())), []);
  return status;
}
