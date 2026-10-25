import { BandMessage, decode, encode, ProtocolError, START_BYTE } from '../protocol';

const messages: BandMessage[] = [
  { type: 'dose_press', timestamp: 1761300000 },
  { type: 'long_press', timestamp: 4294967295 },
  { type: 'status', battery: 87, bandTime: 1761300090, storedEvents: 3 },
  { type: 'set_time', time: 1761300000 },
  { type: 'set_reminders', times: ['07:00', '11:00', '15:30', '23:59'] },
  { type: 'set_reminders', times: [] },
  { type: 'set_tempo', bpm: 70 },
  { type: 'set_vibration', seconds: 10 },
  { type: 'request_events' },
  { type: 'ack', of: 0x11 },
];

describe('protocol', () => {
  it.each(messages.map((m) => [m.type, m]))('round trips %s', (_, message) => {
    expect(decode(encode(message as BandMessage))).toEqual(message);
  });

  it('frames start with the start byte and carry the payload length', () => {
    const frame = encode({ type: 'dose_press', timestamp: 1 });
    expect(frame[0]).toBe(START_BYTE);
    expect(frame[1]).toBe(0x01);
    expect(frame[2]).toBe(4);
    expect(frame.length).toBe(4 + 4);
  });

  it('rejects a damaged frame', () => {
    const frame = encode({ type: 'set_tempo', bpm: 70 });
    frame[3] = 71;
    expect(() => decode(frame)).toThrow(ProtocolError);
  });

  it('rejects a frame with the wrong length', () => {
    const frame = encode({ type: 'dose_press', timestamp: 5 });
    expect(() => decode(frame.slice(0, frame.length - 1))).toThrow(ProtocolError);
  });

  it('rejects bytes that are not a PARKA frame', () => {
    expect(() => decode(Uint8Array.from([0x00, 0x01, 0x00, 0x01]))).toThrow(ProtocolError);
  });

  it('rejects unknown message types', () => {
    const type = 0x55;
    expect(() => decode(Uint8Array.from([START_BYTE, type, 0, type]))).toThrow(ProtocolError);
  });
});
