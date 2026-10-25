import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { band, useBandStatus } from '../band';
import { Screen } from '../components/Screen';
import { Button, Card, Gap, Row, T } from '../components/ui';
import { useNow } from '../hooks/useNow';
import { isRated } from '../logic/checkin';
import { displayStatus, nextReminder } from '../logic/reminders';
import { dateKey, formatDose, formatTime, timeOf } from '../logic/time';
import { ScreenProps } from '../navigation/types';
import { confirmAwake, logDoseNow } from '../services/actions';
import { useApp } from '../state/store';
import { colors, spacing } from '../theme/tokens';

const pills = require('../assets/pills.png');

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function DashboardScreen({ navigation }: ScreenProps<'Dashboard'>) {
  const now = useNow();
  const nowTime = timeOf(now);
  const name = useApp((s) => s.profile?.name);
  const day = useApp((s) => s.day);
  const medications = useApp((s) => s.medications);
  const checkedInToday = useApp((s) => isRated(s.checkIns.find((c) => c.date === dateKey(now))));
  const metronomeToday = useApp((s) => s.metronomeStarts.filter((m) => dateKey(new Date(m.timestamp)) === dateKey(now)).length);
  const [message, setMessage] = useState<string | null>(null);

  const reminders = day.reminders;
  const next = nextReminder(reminders, nowTime);
  const nextSlot = next ? reminders.filter((r) => r.time === next.time && r.status === 'pending') : [];
  const isDue = next ? displayStatus(next, reminders, nowTime) === 'due' : false;
  const taken = reminders.filter((r) => r.status === 'taken').length;
  const dueSoFar = reminders.filter((r) => r.time <= nowTime);
  const allTakenSoFar = dueSoFar.length > 0 && dueSoFar.every((r) => r.status === 'taken');
  const medName = (id: string) => medications.find((m) => m.id === id)?.name ?? 'Medication';

  const awake = async () => setMessage(await confirmAwake());
  const logDose = async () => setMessage(await logDoseNow('app'));

  const clock = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/, '');

  return (
    <Screen showBack={false}>
      <Card style={{ alignItems: 'center', paddingVertical: spacing.md }}>
        <T size="clock" bold center accessibilityRole="header">
          {clock}
        </T>
        <T size="large" bold center>
          {`${greeting(now)}${name ? `, ${name}` : ''}.`}
        </T>
      </Card>

      {/* Next dose: first and largest */}
      <Card style={[styles.doseCard, isDue && styles.dueCard]}>
        <Image source={pills} style={styles.pills} resizeMode="contain" accessibilityIgnoresInvertColors />
        <View style={styles.divider} />
        <View style={{ flex: 1 }} accessible accessibilityLabel={next ? `Next dose: ${nextSlot.map((r) => `${medName(r.medicationId)}, ${formatDose(r.dose)}`).join('; ')}. ${isDue ? 'Due now' : `At ${formatTime(next.time)}`}` : undefined}>
          {next ? (
            <>
              {nextSlot.map((r) => (
                <View key={`${r.medicationId}-${r.usualTime}`} style={{ marginBottom: spacing.xs }}>
                  <T size="large" bold>
                    {medName(r.medicationId)}
                  </T>
                  <T size="body">{formatDose(r.dose)}</T>
                </View>
              ))}
              {isDue ? (
                <T size="large" bold color={colors.red}>
                  {`⚠ Due now (${formatTime(next.time)})`}
                </T>
              ) : (
                <T size="large" bold color={colors.red}>
                  {`Next Dose: ${formatTime(next.time)}`}
                </T>
              )}
            </>
          ) : medications.length === 0 ? (
            <T size="large" bold>
              No medications yet
            </T>
          ) : (
            <T size="large" bold>
              No more doses today
            </T>
          )}
        </View>
      </Card>
      {medications.length === 0 && <Button label="Add a medication" onPress={() => navigation.navigate('AddMedStart')} />}
      {next && isDue && <Button label="I took it" onPress={logDose} accessibilityHint="Logs this dose as taken now" />}

      {message && (
        <Card tint>
          <T size="large" bold color={colors.pine} accessibilityRole="text">
            {message}
          </T>
        </Card>
      )}

      {!day.awakeAt && reminders.length > 0 && (
        <Button label="I’m awake" onPress={awake} accessibilityHint="Sets today’s reminder times from now" />
      )}

      {!checkedInToday && <Button label="Daily Check-In" onPress={() => navigation.navigate('CheckInHome')} />}

      <Card>
        <T size="heading" bold center accessibilityRole="header" style={{ textDecorationLine: 'underline' }}>
          Today’s Summary
        </T>
        <Gap size="sm" />
        <T size="large" center>
          <T size="large" bold>
            Doses taken:{' '}
          </T>
          {`${taken}/${reminders.length}`}
        </T>
        <T size="large" center>
          <T size="large" bold>
            Metronome used:{' '}
          </T>
          {`${metronomeToday} ${metronomeToday === 1 ? 'time' : 'times'}`}
        </T>
        {day.awakeAt && <T size="body" center color={colors.muted}>{`Awake at ${formatTime(day.awakeAt)}. Reminders set from then.`}</T>}
        {allTakenSoFar && (
          <T size="body" center bold color={colors.pine}>
            All doses so far are taken.
          </T>
        )}
      </Card>

      <BandStatusCard />
    </Screen>
  );
}

function BandStatusCard() {
  const status = useBandStatus();
  useNow(); // refresh "synced N min ago"
  const minutes = status.lastSync ? Math.round((Date.now() - status.lastSync.getTime()) / 60000) : undefined;
  const synced = minutes === undefined ? '' : minutes < 1 ? ', synced just now' : `, synced ${minutes} min ago`;
  return (
    <Card>
      <Row>
        <View style={[styles.dot, { backgroundColor: status.connected ? colors.pine : colors.red }]} />
        <View style={{ flex: 1 }}>
          <T size="body" bold>
            Wristband
          </T>
          <T size="large">{status.connected ? `Connected${synced}` : 'Not connected'}</T>
          {status.connected && status.battery !== undefined && <T size="small" color={colors.muted}>{`Battery ${status.battery}%`}</T>}
        </View>
      </Row>
      {!status.connected && (
        <>
          <Gap size="sm" />
          <Button label="Connect" size="normal" onPress={() => band.connect()} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  doseCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 130 },
  dueCard: { borderWidth: 4, borderColor: colors.red },
  pills: { width: 72, height: 72 },
  divider: { width: 4, alignSelf: 'stretch', backgroundColor: colors.text, borderRadius: 2 },
  dot: { width: 24, height: 24, borderRadius: 12 },
});
