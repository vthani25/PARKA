// The app talks to the wristband only through this interface, so the simulated band
// can be swapped for real Bluetooth (BleBandService) without changing any screen.

export type BandEventType = 'dose_press' | 'long_press';

export type BandStatus = { connected: boolean; lastSync?: Date; battery?: number };

export interface BandService {
  onEvent(cb: (e: { type: BandEventType; timestamp: number }) => void): void;
  setReminders(times: string[]): Promise<void>;
  setMetronomeTempo(bpm: number): Promise<void>;
  status(): BandStatus;
  /** Called whenever status() changes, so screens can refresh. */
  onStatusChange(cb: () => void): () => void;
  /** True for the simulated band (MockBandService). */
  readonly simulated: boolean;
}
