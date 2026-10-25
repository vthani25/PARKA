import * as ImagePicker from 'expo-image-picker';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import React, { useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { band, useBandStatus } from '../band';
import { Screen } from '../components/Screen';
import { Button, Card, Choice, Gap, Heading, Label, T, TextField } from '../components/ui';
import { ScreenProps } from '../navigation/types';
import { requestExactAlarmPermission, requestNotificationPermission, scheduleWakeNotification } from '../services/notifications';
import { useApp } from '../state/store';
import { colors } from '../theme/tokens';
import { FontScale } from '../types';

const TOTAL_STEPS = 5;

export function OnboardingScreen({ navigation, route }: ScreenProps<'Onboarding'>) {
  const step = route.params.step;
  const next = () => navigation.push('Onboarding', { step: step + 1 });

  const finish = async (thenAddMedication: boolean) => {
    useApp.getState().completeOnboarding();
    scheduleWakeNotification().catch(() => {});
    navigation.reset({
      index: thenAddMedication ? 1 : 0,
      routes: thenAddMedication ? [{ name: 'Dashboard' }, { name: 'AddMedStart' }] : [{ name: 'Dashboard' }],
    });
  };

  return (
    <Screen showMenu={false} headerTitle="ONBOARDING">
      <Label size="large">{`STEP ${step} of ${TOTAL_STEPS}`}</Label>
      {step === 1 && <NameStep onNext={next} />}
      {step === 2 && <DisplayStep onNext={next} />}
      {step === 3 && <PermissionsStep onNext={next} />}
      {step === 4 && <BandStep onNext={next} />}
      {step === 5 && <FirstMedicationStep onAdd={() => finish(true)} onSkip={() => finish(false)} />}
    </Screen>
  );
}

function NameStep({ onNext }: { onNext: () => void }) {
  const profile = useApp((s) => s.profile);
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const save = () => {
    useApp.getState().setProfile({ name: name.trim(), phone: phone.trim() || undefined });
    onNext();
  };
  return (
    <Card>
      <Heading size="heading">Personal Information</Heading>
      <TextField label="Name" value={name} onChange={setName} placeholder="Your first name" />
      <TextField
        label="Phone number (optional)"
        hint="So reports and your hospital card can include your number."
        value={phone}
        onChange={setPhone}
        placeholder="(555) 555-5555"
        keyboardType="phone-pad"
      />
      {!name.trim() && <T size="body" color={colors.muted}>Please type your name to continue.</T>}
      <Gap />
      <Button label="Next" onPress={save} disabled={!name.trim()} />
    </Card>
  );
}

function DisplayStep({ onNext }: { onNext: () => void }) {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const sizes: { label: string; value: FontScale }[] = [
    { label: 'Large', value: 1 },
    { label: 'Larger', value: 1.2 },
    { label: 'Largest', value: 1.4 },
  ];
  return (
    <>
      <Card>
        <Heading size="heading">Text size</Heading>
        {sizes.map((s) => (
          <Choice key={s.value} label={s.label} selected={settings.fontScale === s.value} onPress={() => update({ fontScale: s.value })} />
        ))}
      </Card>
      <Card>
        <Heading size="heading">Display and voice</Heading>
        <Choice label="High contrast" detail="Plain background, black text, thick borders" selected={settings.highContrast} onPress={() => update({ highContrast: !settings.highContrast })} />
        <Choice label="Voice control" detail="Shows the microphone button on every screen" selected={settings.voiceEnabled} onPress={() => update({ voiceEnabled: !settings.voiceEnabled })} />
      </Card>
      <Card tint>
        <T size="small" bold color={colors.pine}>
          Preview
        </T>
        <T size="heading" bold>
          Next dose: 11:00 AM
        </T>
        <T size="body">This is how text will look in PARKA.</T>
      </Card>
      <Button label="Next" onPress={onNext} />
    </>
  );
}

type PermissionItem = { key: string; title: string; reason: string; ifDeclined: string; request: () => Promise<boolean> };

const PERMISSIONS: PermissionItem[] = [
  {
    key: 'notifications',
    title: 'Notifications',
    reason: 'So PARKA can remind you when it’s time for your medication, and say good morning.',
    ifDeclined: 'Without this, you won’t get dose reminders on your phone.',
    request: async () => (await requestNotificationPermission()) === 'granted',
  },
  {
    key: 'alarms',
    title: 'Exact alarms',
    reason: 'So reminders arrive at the exact minute, not a few minutes late. Android opens a settings page: turn on “Allow” and come back.',
    ifDeclined: 'Without this, reminders may arrive a few minutes late.',
    request: async () => (await requestExactAlarmPermission()) === 'granted',
  },
  {
    key: 'microphone',
    title: 'Microphone',
    reason: 'So you can use voice commands and speak your notes instead of typing.',
    ifDeclined: 'Without this, voice commands and spoken notes won’t work. Everything else will.',
    request: async () => (await ExpoSpeechRecognitionModule.requestPermissionsAsync()).granted,
  },
  {
    key: 'camera',
    title: 'Camera',
    reason: 'So you can take a photo of a pill bottle and PARKA can read the label.',
    ifDeclined: 'Without this, you can still type medications in.',
    request: async () => (await ImagePicker.requestCameraPermissionsAsync()).granted,
  },
  {
    key: 'nearby',
    title: 'Nearby devices',
    reason: 'So PARKA can connect to your wristband over Bluetooth.',
    ifDeclined: 'Without this, PARKA can’t connect to a real wristband.',
    request: async () => {
      if (Platform.OS !== 'android' || Platform.Version < 31) return true;
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
    },
  },
];

function PermissionsStep({ onNext }: { onNext: () => void }) {
  const [index, setIndex] = useState(0);
  const [declined, setDeclined] = useState<string | null>(null);
  const item = PERMISSIONS[index];

  const advance = () => {
    setDeclined(null);
    if (index + 1 < PERMISSIONS.length) setIndex(index + 1);
    else onNext();
  };

  const allow = async () => {
    let granted = false;
    try {
      granted = await item.request();
    } catch {
      granted = false;
    }
    if (granted) advance();
    else setDeclined(item.ifDeclined);
  };

  return (
    <Card>
      <T size="body" center color={colors.muted}>{`Permission ${index + 1} of ${PERMISSIONS.length}`}</T>
      <Heading size="heading">{item.title}</Heading>
      <T size="large">{item.reason}</T>
      <Gap size="lg" />
      {declined ? (
        <>
          <Card tint>
            <T size="body" bold>
              {declined}
            </T>
            <T size="small">You can turn it on later in Android settings.</T>
          </Card>
          <Button label="Continue" onPress={advance} />
        </>
      ) : (
        <>
          <Button label="Allow" onPress={allow} />
          <Button label="Not now" variant="outline" onPress={() => setDeclined(item.ifDeclined)} />
        </>
      )}
    </Card>
  );
}

function BandStep({ onNext }: { onNext: () => void }) {
  const status = useBandStatus();
  const [connecting, setConnecting] = useState(false);
  const connect = async () => {
    setConnecting(true);
    await band.connect();
    setConnecting(false);
  };
  return (
    <Card>
      <Heading size="heading">Connect your wristband</Heading>
      <T size="large">Press the big button on your PARKA band once, then tap Connect.</T>
      <Gap size="lg" />
      {status.connected ? (
        <>
          <T size="large" bold color={colors.pine}>
            ✓ Connected
          </T>
          <Gap />
          <Button label="Next" onPress={onNext} />
        </>
      ) : (
        <>
          <Button label={connecting ? 'Connecting…' : 'Connect'} onPress={connect} disabled={connecting} />
          <Button label="Skip for now" variant="outline" onPress={onNext} />
        </>
      )}
    </Card>
  );
}

function FirstMedicationStep({ onAdd, onSkip }: { onAdd: () => void; onSkip: () => void }) {
  return (
    <Card>
      <Heading size="heading">Add your first medication</Heading>
      <T size="large">Take a photo of the pill bottle or type the name. You can always add more later.</T>
      <Gap size="lg" />
      <Button label="Add a medication" onPress={onAdd} />
      <Button label="Skip for now" variant="outline" onPress={onSkip} />
    </Card>
  );
}
