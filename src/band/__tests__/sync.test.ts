import { MockBandService } from '../MockBandService';
import { decode, encode } from '../protocol';
import { BandLink, syncWithBand } from '../sync';

const NOW = 1_761_300_000_000; // fixed phone time (ms)

function fakeBand(bandTime: number, stored: { type: 'dose_press' | 'long_press'; timestamp: number }[]) {
  const received: string[] = [];
  const link: BandLink = {
    request: async (frame) => {
      const message = decode(frame);
      received.push(message.type);
      if (message.type === 'request_events') {
        return [encode({ type: 'status', battery: 80, bandTime, storedEvents: stored.length }), ...stored.map(encode)];
      }
      return [encode({ type: 'ack', of: frame[1] })];
    },
  };
  return { link, received };
}

describe('syncWithBand', () => {
  it('corrects stored event times when the band clock is 90 s fast, and resets the clock', async () => {
    const phoneSeconds = NOW / 1000;
    const band = fakeBand(phoneSeconds + 90, [{ type: 'dose_press', timestamp: phoneSeconds + 90 - 600 }]);
    const result = await syncWithBand(band.link, {}, new Set(), () => NOW);

    expect(result.clockOffsetSeconds).toBe(90);
    expect(result.clockCorrected).toBe(true);
    expect(result.events).toEqual([{ type: 'dose_press', timestamp: NOW - 600_000 }]);
    expect(band.received).toEqual(['request_events', 'set_time', 'ack']);
  });

  it('leaves a clock that is only a few seconds off', async () => {
    const band = fakeBand(NOW / 1000 + 5, []);
    const result = await syncWithBand(band.link, {}, new Set(), () => NOW);
    expect(result.clockCorrected).toBe(false);
    expect(band.received).not.toContain('set_time');
  });

  it('sends waiting reminders and tempo', async () => {
    const band = fakeBand(NOW / 1000, []);
    await syncWithBand(band.link, { reminders: ['07:00', '11:00'], tempo: 70 }, new Set(), () => NOW);
    expect(band.received).toEqual(['request_events', 'ack', 'set_reminders', 'set_tempo']);
  });

  it('skips events it has already seen', async () => {
    const t = NOW / 1000 - 60;
    const seen = new Set<string>();
    const first = await syncWithBand(fakeBand(NOW / 1000, [{ type: 'long_press', timestamp: t }]).link, {}, seen, () => NOW);
    const again = await syncWithBand(fakeBand(NOW / 1000, [{ type: 'long_press', timestamp: t }]).link, {}, seen, () => NOW);
    expect(first.events).toHaveLength(1);
    expect(again.events).toHaveLength(0);
  });
});

describe('MockBandService', () => {
  it('delivers live presses and stored presses through the protocol', async () => {
    const band = new MockBandService();
    const events: string[] = [];
    band.onEvent((e) => events.push(e.type));

    await band.connect();
    band.simulateShortPress();
    band.simulateLongPress();
    expect(events).toEqual(['dose_press', 'long_press']);

    await band.reconnectWithStoredEvents();
    expect(events).toEqual(['dose_press', 'long_press', 'long_press', 'dose_press', 'long_press']);
  });

  it('queues reminders while disconnected and sends them on reconnect', async () => {
    const band = new MockBandService();
    await band.setReminders(['07:00', '11:00']);
    expect(band.bandState().reminders).toEqual([]);
    await band.connect();
    expect(band.bandState().reminders).toEqual(['07:00', '11:00']);
  });

  it('fixes a skewed band clock on reconnect', async () => {
    const band = new MockBandService();
    await band.connect();
    band.skewClock(90);
    band.disconnect();
    await band.connect();
    expect(Math.abs(band.bandState().clockSkewSeconds)).toBeLessThanOrEqual(1);
  });
});
