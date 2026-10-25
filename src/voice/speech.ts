// Speech to text with Android's built-in speech recognizer, plus spoken read-back.
// Only one part of the app listens at a time (voice commands or spoken notes).

import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useRef, useState } from 'react';

let currentOwner: string | null = null;

export function say(text: string) {
  Speech.stop();
  Speech.speak(text, { language: 'en-US', rate: 0.9 });
}

/** onFinal gets the best transcript, plus the recognizer's other guesses (best first). */
type Options = { onFinal: (text: string, alternatives: string[]) => void; onNothingHeard?: () => void; continuous?: boolean; alternatives?: number };

/** Live transcription for one owner. `transcript` updates as the person speaks. */
export function useListener(owner: string, { onFinal, onNothingHeard, continuous = false, alternatives = 1 }: Options) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const gotFinal = useRef(false);
  const lastHeard = useRef('');
  const mine = () => currentOwner === owner;

  useSpeechRecognitionEvent('start', () => mine() && setListening(true));
  useSpeechRecognitionEvent('result', (e) => {
    if (!mine()) return;
    const text = e.results[0]?.transcript ?? '';
    setTranscript(text);
    if (text) lastHeard.current = text;
    if (e.isFinal) {
      gotFinal.current = true;
      onFinal(text, e.results.map((r) => r.transcript).filter(Boolean));
    }
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (!mine()) return;
    if (e.error === 'no-speech' || e.error === 'speech-timeout') setError(null);
    else setError(e.error === 'not-allowed' ? 'Microphone permission is off. Turn it on in Android settings to use voice.' : 'Voice is not available right now.');
  });
  useSpeechRecognitionEvent('end', () => {
    if (!mine()) return;
    setListening(false);
    currentOwner = null;
    if (gotFinal.current) return;
    // Some phones end without a final result. Use the last words we showed on screen.
    if (lastHeard.current) {
      gotFinal.current = true;
      onFinal(lastHeard.current, [lastHeard.current]);
    } else onNothingHeard?.();
  });

  async function start() {
    setError(null);
    setTranscript('');
    gotFinal.current = false;
    lastHeard.current = '';
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone permission is off. Turn it on in Android settings to use voice.');
      return;
    }
    Speech.stop();
    if (currentOwner) ExpoSpeechRecognitionModule.abort();
    currentOwner = owner;
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous, maxAlternatives: alternatives });
  }

  function stop() {
    if (mine()) ExpoSpeechRecognitionModule.stop();
  }

  function cancel() {
    if (mine()) ExpoSpeechRecognitionModule.abort();
    currentOwner = null;
    setListening(false);
  }

  return { listening, transcript, error, start, stop, cancel };
}
