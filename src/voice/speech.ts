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

type Options = { onFinal: (text: string) => void; onNothingHeard?: () => void; continuous?: boolean };

/** Live transcription for one owner. `transcript` updates as the person speaks. */
export function useListener(owner: string, { onFinal, onNothingHeard, continuous = false }: Options) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const gotFinal = useRef(false);
  const mine = () => currentOwner === owner;

  useSpeechRecognitionEvent('start', () => mine() && setListening(true));
  useSpeechRecognitionEvent('result', (e) => {
    if (!mine()) return;
    const text = e.results[0]?.transcript ?? '';
    setTranscript(text);
    if (e.isFinal) {
      gotFinal.current = true;
      onFinal(text);
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
    if (!gotFinal.current) onNothingHeard?.();
  });

  async function start() {
    setError(null);
    setTranscript('');
    gotFinal.current = false;
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone permission is off. Turn it on in Android settings to use voice.');
      return;
    }
    Speech.stop();
    if (currentOwner) ExpoSpeechRecognitionModule.abort();
    currentOwner = owner;
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous, maxAlternatives: 1 });
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
