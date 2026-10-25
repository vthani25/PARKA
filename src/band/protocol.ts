// PARKA band protocol: how the app and the wristband talk over Bluetooth.
//
// Every message is one small frame of bytes:
//
//   [ 0xA5 ][ type ][ length ][ payload ... ][ checksum ]
//     start   1 byte  1 byte    `length` bytes  XOR of type, length and payload
//
// Times are seconds since 1 Jan 1970 (UTC), 4 bytes, big-endian, read from the band's RTC module.

export const START_BYTE = 0xa5;

export const MessageType = {
  // Band -> app
  DOSE_PRESS: 0x01, // short press: "I took my dose"
  LONG_PRESS: 0x02, // long press: metronome started
  STATUS: 0x03, // battery, band clock, number of stored events
  // App -> band
  SET_TIME: 0x10, // set the band's RTC clock
  SET_REMINDERS: 0x11, // today's dose times
  SET_TEMPO: 0x12, // metronome beats per minute
  SET_VIBRATION: 0x13, // dose-time vibration length in seconds
  REQUEST_EVENTS: 0x14, // send me the events stored in flash
  ACK: 0x7f,
} as const;

export type BandMessage =
  | { type: 'dose_press'; timestamp: number }
  | { type: 'long_press'; timestamp: number }
  | { type: 'status'; battery: number; bandTime: number; storedEvents: number }
  | { type: 'set_time'; time: number }
  | { type: 'set_reminders'; times: string[] } // "HH:mm"
  | { type: 'set_tempo'; bpm: number }
  | { type: 'set_vibration'; seconds: number }
  | { type: 'request_events' }
  | { type: 'ack'; of: number };

export class ProtocolError extends Error {}

/** Turn a message into bytes to send. */
export function encode(message: BandMessage): Uint8Array {
  const [type, payload] = payloadFor(message);
  const frame = [START_BYTE, type, payload.length, ...payload, checksum(type, payload)];
  return Uint8Array.from(frame);
}

/** Turn received bytes back into a message. Throws ProtocolError if the frame is damaged. */
export function decode(bytes: Uint8Array): BandMessage {
  if (bytes.length < 4 || bytes[0] !== START_BYTE) throw new ProtocolError('Not a PARKA frame');
  const type = bytes[1];
  const length = bytes[2];
  if (bytes.length !== length + 4) throw new ProtocolError('Wrong frame length');
  const payload = Array.from(bytes.slice(3, 3 + length));
  if (bytes[3 + length] !== checksum(type, payload)) throw new ProtocolError('Checksum mismatch');

  switch (type) {
    case MessageType.DOSE_PRESS:
      return { type: 'dose_press', timestamp: readUint32(payload, 0) };
    case MessageType.LONG_PRESS:
      return { type: 'long_press', timestamp: readUint32(payload, 0) };
    case MessageType.STATUS:
      return { type: 'status', battery: payload[0], bandTime: readUint32(payload, 1), storedEvents: payload[5] };
    case MessageType.SET_TIME:
      return { type: 'set_time', time: readUint32(payload, 0) };
    case MessageType.SET_REMINDERS: {
      // payload: count, then one (hour, minute) pair per reminder
      const times: string[] = [];
      for (let i = 0; i < payload[0]; i++) {
        const h = payload[1 + i * 2];
        const m = payload[2 + i * 2];
        times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
      return { type: 'set_reminders', times };
    }
    case MessageType.SET_TEMPO:
      return { type: 'set_tempo', bpm: payload[0] };
    case MessageType.SET_VIBRATION:
      return { type: 'set_vibration', seconds: payload[0] };
    case MessageType.REQUEST_EVENTS:
      return { type: 'request_events' };
    case MessageType.ACK:
      return { type: 'ack', of: payload[0] };
    default:
      throw new ProtocolError(`Unknown message type 0x${type.toString(16)}`);
  }
}

function payloadFor(message: BandMessage): [number, number[]] {
  switch (message.type) {
    case 'dose_press':
      return [MessageType.DOSE_PRESS, uint32(message.timestamp)];
    case 'long_press':
      return [MessageType.LONG_PRESS, uint32(message.timestamp)];
    case 'status':
      return [MessageType.STATUS, [byte(message.battery), ...uint32(message.bandTime), byte(message.storedEvents)]];
    case 'set_time':
      return [MessageType.SET_TIME, uint32(message.time)];
    case 'set_reminders': {
      if (message.times.length > 24) throw new ProtocolError('At most 24 reminders');
      const pairs = message.times.flatMap((t) => t.split(':').map(Number));
      return [MessageType.SET_REMINDERS, [message.times.length, ...pairs]];
    }
    case 'set_tempo':
      return [MessageType.SET_TEMPO, [byte(message.bpm)]];
    case 'set_vibration':
      return [MessageType.SET_VIBRATION, [byte(message.seconds)]];
    case 'request_events':
      return [MessageType.REQUEST_EVENTS, []];
    case 'ack':
      return [MessageType.ACK, [byte(message.of)]];
  }
}

function checksum(type: number, payload: number[]): number {
  return payload.reduce((x, b) => x ^ b, type ^ payload.length);
}

function uint32(value: number): number[] {
  const v = Math.floor(value) >>> 0;
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
}

function readUint32(bytes: number[], offset: number): number {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function byte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/** "a5 01 04 ..." for the debug panel. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}
