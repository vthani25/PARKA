import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Vibration, View } from 'react-native';
import { band, todaysBandTimes, useBandStatus } from '../band';
import { FrameLogLine } from '../band/MockBandService';
import { Screen } from '../components/Screen';
import { Button, Card, Choice, Gap, Heading, Label, Row, Stepper, T, TextField } from '../components/ui';
import { rebuildReminders } from '../logic/reminders';
import { formatTime, fromMinutes } from '../logic/time';
import { ScreenProps } from '../navigation/types';
import { scheduleDoseNotifications, scheduleWakeNotification, sendWakeNotificationNow } from '../services/notifications';
import { useApp } from '../state/store';
import { colors, fonts, spacing } from '../theme/tokens';
import { FontScale } from '../types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <T size="large" bold accessibilityRole="header" style={{ marginBottom: spacing.sm }}>
        {title}
      </T>
      {children}
    </Card>
  );
}

export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const trackableCount = useApp((s) => s.trackables.length);
  const [confirmSample, setConfirmSample] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const sizes: { label: string; value: FontScale }[] = [
    { label: 'Large', value: 1 },
    { label: 'Larger', value: 1.2 },
    { label: 'Largest', value: 1.4 },
  ];

  const changeWakeTime = () => {
    const [h, m] = settings.wakeNotificationTime.split(':').map(Number);
    const value = new Date();
    value.setHours(h, m, 0, 0);
    DateTimePickerAndroid.open({
      value,
      mode: 'time',
      is24Hour: false,
      onChange: async (event, date) => {
        if (event.type !== 'set' || !date) return;
        update({ wakeNotificationTime: fromMinutes(date.getHours() * 60 + date.getMinutes()) });
        await scheduleWakeNotification().catch(() => {});
      },
    });
  };

  const setTempo = (bpm: number) => {
    update({ metronomeTempo: bpm });
    band.setMetronomeTempo(bpm);
  };
  const setVibration = (seconds: number) => {
    update({ vibrateSeconds: seconds });
    band.setVibrationSeconds(seconds);
  };

  const resetAwake = async () => {
    useApp.setState((s) => ({ day: { ...s.day, awakeAt: undefined, reminders: rebuildReminders(s.schedules, s.day.reminders) } }));
    await scheduleDoseNotifications().catch(() => {});
    await band.setReminders(todaysBandTimes());
    setNotice('Today’s reminders are back to the usual times.');
  };

  const loadSample = async () => {
    useApp.getState().loadSampleData();
    setConfirmSample(false);
    await scheduleDoseNotifications().catch(() => {});
    await band.setReminders(todaysBandTimes());
    setNotice('Sample data loaded.');
  };

  return (
    <Screen>
      <Heading>Settings</Heading>

      <Section title="Text size">
        {sizes.map((s) => (
          <Choice key={s.value} label={s.label} selected={settings.fontScale === s.value} onPress={() => update({ fontScale: s.value })} />
        ))}
      </Section>

      <Section title="Display and voice">
        <Choice label="High contrast" selected={settings.highContrast} onPress={() => update({ highContrast: !settings.highContrast })} />
        <Choice label="Voice control" detail="Microphone button on every screen" selected={settings.voiceEnabled} onPress={() => update({ voiceEnabled: !settings.voiceEnabled })} />
      </Section>

      <Section title="Metronome tempo">
        <T size="body">Steps per minute when you long-press the band. Slower helps take longer steps.</T>
        <Stepper label="metronome tempo" value={settings.metronomeTempo} step={5} min={40} max={140} format={(v) => `${v} per min`} onChange={setTempo} />
      </Section>

      <Section title="Dose vibration length">
        <T size="body">How long the band vibrates at dose time.</T>
        <Stepper label="vibration length" value={settings.vibrateSeconds} step={1} min={3} max={30} format={(v) => `${v} seconds`} onChange={setVibration} />
      </Section>

      <Section title="Good morning notification">
        <T size="large">{`Every day at ${formatTime(settings.wakeNotificationTime)}`}</T>
        <Gap size="sm" />
        <Button label="Change time" variant="outline" size="normal" onPress={changeWakeTime} />
        <T size="body" bold>
          First dose after waking
        </T>
        <Stepper label="minutes from waking to first dose" value={settings.wakeOffsetMinutes} step={15} min={0} max={120} format={(v) => (v === 0 ? 'Right away' : `${v} min later`)} onChange={(v) => update({ wakeOffsetMinutes: v })} />
      </Section>

      <Section title="Daily check-in">
        <T size="body">{trackableCount ? `${trackableCount} trackables chosen` : 'No trackables chosen yet'}</T>
        <Gap size="sm" />
        <Button label="Choose trackables" variant="outline" size="normal" onPress={() => navigation.navigate('ChooseTrackables')} />
      </Section>

      <Section title="Report recipients">
        <T size="body">{settings.recipients.length ? settings.recipients.map((r) => r.name).join(', ') : 'No one added yet'}</T>
        <Gap size="sm" />
        <Button label="Manage recipients" variant="outline" size="normal" onPress={() => navigation.navigate('Recipients')} />
      </Section>

      <Section title="For demos and testing">
        <Button label="Send I’m awake notification now" variant="outline" size="normal" onPress={() => sendWakeNotificationNow()} />
        <Button label="Reset today’s I’m awake" variant="outline" size="normal" onPress={resetAwake} />
        {confirmSample ? (
          <>
            <T size="body" bold color={colors.red}>
              This replaces your medications, trackables and check-ins with sample data.
            </T>
            <Button label="Yes, load sample data" variant="red" size="normal" onPress={loadSample} />
            <Button label="No" variant="outline" size="normal" onPress={() => setConfirmSample(false)} />
          </>
        ) : (
          <Button label="Load sample data" variant="outline" size="normal" onPress={() => setConfirmSample(true)} />
        )}
        {notice && <T size="body" bold color={colors.pine}>{notice}</T>}
      </Section>

      {/* Long press the version number to open the band debug panel (developer only). */}
      <Pressable onLongPress={() => navigation.navigate('BandDebug')} delayLongPress={800} accessibilityLabel={`PARKA version ${Constants.expoConfig?.version ?? '1.0.0'}`}>
        <Label size="small" bold={false}>{`PARKA version ${Constants.expoConfig?.version ?? '1.0.0'}`}</Label>
      </Pressable>
    </Screen>
  );
}

export function RecipientsScreen() {
  const recipients = useApp((s) => s.settings.recipients);
  const { addRecipient, removeRecipient } = useApp.getState();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  const add = () => {
    addRecipient({ name: name.trim(), phone: phone.trim(), relationship: relationship.trim() || undefined });
    setName('');
    setPhone('');
    setRelationship('');
  };

  return (
    <Screen>
      <Heading>Report recipients</Heading>
      <Label bold={false}>People you can text your reports to. PARKA never sends anything by itself.</Label>
      {recipients.map((r) => (
        <Card key={r.id}>
          <T size="large" bold>{`${r.name}${r.relationship ? ` (${r.relationship})` : ''}`}</T>
          <T size="body">{r.phone}</T>
          <Gap size="sm" />
          {removing === r.id ? (
            <>
              <T size="body" bold>{`Remove ${r.name}?`}</T>
              <Button label="Yes, remove" variant="red" size="normal" onPress={() => removeRecipient(r.id)} />
              <Button label="No" variant="outline" size="normal" onPress={() => setRemoving(null)} />
            </>
          ) : (
            <Button label="Remove" variant="outline" size="normal" onPress={() => setRemoving(r.id)} />
          )}
        </Card>
      ))}
      <Card>
        <T size="large" bold accessibilityRole="header">
          Add a person
        </T>
        <Gap size="sm" />
        <TextField label="Name" value={name} onChange={setName} placeholder="For example, Dr. Lee" />
        <TextField label="Phone number" value={phone} onChange={setPhone} keyboardType="phone-pad" />
        <TextField label="Relationship (optional)" value={relationship} onChange={setRelationship} placeholder="Caregiver, doctor, family" />
        <Button label="Add" onPress={add} disabled={!name.trim() || phone.replace(/\D/g, '').length < 7} />
      </Card>
    </Screen>
  );
}

// MOCK: debug panel for the simulated band.
export function BandDebugScreen() {
  const status = useBandStatus();
  const tempo = useApp((s) => s.settings.metronomeTempo);
  const [log, setLog] = useState<FrameLogLine[]>(band.log);
  const [state, setState] = useState(band.bandState());
  useEffect(() => band.onLogChange(() => {
    setLog(band.log);
    setState(band.bandState());
  }), []);

  const longPress = () => {
    band.simulateLongPress();
    // The phone vibrates in place of the band's haptic metronome, for 8 beats.
    const beat = Math.round(60000 / tempo);
    Vibration.vibrate(Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? (i === 0 ? 0 : beat - 120) : 120)));
  };

  return (
    <Screen>
      <Heading>Band debug panel</Heading>
      <Card>
        <T size="large" bold>
          {status.connected ? 'Connected' : 'Not connected'}
        </T>
        <T size="body">{`Band reminders: ${state.reminders.length ? state.reminders.map(formatTime).join(', ') : 'none'}`}</T>
        <T size="body">{`Band tempo: ${state.tempo} per min · Vibration: ${state.vibrateSeconds} s`}</T>
        <T size="body">{`Band clock offset: ${state.clockSkewSeconds} s`}</T>
      </Card>
      <Button label="Short press (dose taken)" onPress={() => band.simulateShortPress()} disabled={!status.connected} />
      <Button label="Long press (metronome)" onPress={longPress} disabled={!status.connected} />
      {status.connected ? (
        <Button label="Disconnect" variant="red" onPress={() => band.disconnect()} />
      ) : (
        <Button label="Connect" onPress={() => band.connect()} />
      )}
      <Button label="Reconnect with 3 stored events" variant="outline" onPress={() => band.reconnectWithStoredEvents()} />
      <Button label="Move band clock 90 seconds ahead" variant="outline" onPress={() => band.skewClock(90)} />
      <Card>
        <T size="large" bold accessibilityRole="header">
          Messages (newest first)
        </T>
        {log.length === 0 && <T size="body">No messages yet.</T>}
        {log.map((l, i) => (
          <View key={i} style={styles.logLine}>
            <Row>
              <T size="small" bold color={l.direction === 'from band' ? colors.pine : l.direction === 'to band' ? colors.red : colors.muted}>
                {l.direction === 'note' ? '•' : l.direction === 'to band' ? '→ band' : '← band'}
              </T>
              <T size="small" color={colors.muted}>
                {new Date(l.at).toLocaleTimeString('en-US')}
              </T>
            </Row>
            <T size="small" style={{ fontFamily: l.direction === 'note' ? fonts.bold : fonts.regular }}>
              {l.text}
            </T>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logLine: { borderBottomWidth: 1, borderBottomColor: colors.pineTint, paddingVertical: spacing.xs },
});
