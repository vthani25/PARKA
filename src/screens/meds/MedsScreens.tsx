import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { band, todaysBandTimes } from '../../band';
import { Screen } from '../../components/Screen';
import { Button, Card, Gap, Heading, T, useSteadyPress } from '../../components/ui';
import { useNow } from '../../hooks/useNow';
import { DisplayStatus, displayStatus, findLog, nextReminder } from '../../logic/reminders';
import { formatDose, formatTime, timeOf, toMinutes } from '../../logic/time';
import { ScreenProps } from '../../navigation/types';
import { scheduleDoseNotifications } from '../../services/notifications';
import { useDraft } from '../../state/draft';
import { useApp } from '../../state/store';
import { colors, spacing, TOUCH_TARGET } from '../../theme/tokens';
import { Reminder } from '../../types';

const pills = require('../../assets/pills.png');
const scanIcon = require('../../assets/scan_pills.png');

/** Status as an icon plus a word, never color alone. */
export const STATUS_LABEL: Record<DisplayStatus, { icon: string; word: string; color: string }> = {
  taken: { icon: '✓', word: 'Taken', color: colors.pine },
  due: { icon: '⚠', word: 'Due now', color: colors.red },
  next: { icon: '➜', word: 'Next', color: colors.text },
  upcoming: { icon: '○', word: 'Upcoming', color: colors.muted },
  missed: { icon: '✗', word: 'Missed', color: colors.red },
};

const PERIODS = [
  { label: 'Morning', from: 0, to: 12 * 60 },
  { label: 'Afternoon', from: 12 * 60, to: 17 * 60 },
  { label: 'Evening', from: 17 * 60, to: 24 * 60 },
];

// ---- Manage Meds ----

export function ManageMedsScreen({ navigation }: ScreenProps<'ManageMeds'>) {
  const now = useNow();
  const nowTime = timeOf(now);
  const day = useApp((s) => s.day);
  const medications = useApp((s) => s.medications);
  const doseLogs = useApp((s) => s.doseLogs);
  const medName = (id: string) => medications.find((m) => m.id === id)?.name ?? 'Medication';
  const next = nextReminder(day.reminders, nowTime);
  const takenAt = (r: Reminder) => {
    const log = findLog(doseLogs, day.date, r);
    return log ? timeOf(new Date(log.loggedAt)) : undefined;
  };

  return (
    <Screen>
      <Heading>Manage Meds</Heading>
      {next && (
        <Card style={styles.nextCard}>
          <Image source={pills} style={{ width: 64, height: 64 }} resizeMode="contain" />
          <View style={styles.divider} />
          <View style={{ flex: 1 }}>
            <T size="large" bold>
              {medName(next.medicationId)}
            </T>
            <T size="large" bold color={colors.red}>{`Next Dose: ${formatTime(next.time)}`}</T>
          </View>
        </Card>
      )}
      <Button label="Scan Pills" icon={scanIcon} onPress={() => navigation.navigate('AddMedStart')} />

      {day.reminders.length === 0 ? (
        <Card>
          <T size="large">No medications yet. Tap Scan Pills to add one.</T>
        </Card>
      ) : (
        <Card style={styles.table}>
          <View style={[styles.tr, styles.th]}>
            <View style={[styles.cell, styles.colMed]}>
              <T size="body" bold center>Medication</T>
            </View>
            <View style={[styles.cell, styles.colTime]}>
              <T size="body" bold center>Time Today</T>
            </View>
            <View style={[styles.cell, styles.colTaken, styles.lastCell]}>
              <T size="body" bold center>Taken at</T>
            </View>
          </View>
          {PERIODS.map((p) => {
            const rows = day.reminders.filter((r) => toMinutes(r.time) >= p.from && toMinutes(r.time) < p.to);
            if (rows.length === 0) return null;
            return (
              <View key={p.label}>
                <View style={styles.period}>
                  <T size="body" bold color={colors.pine} accessibilityRole="header">
                    {p.label}
                  </T>
                </View>
                {rows.map((r) => {
                  const status = STATUS_LABEL[displayStatus(r, day.reminders, nowTime)];
                  const at = takenAt(r);
                  return (
                    <TableRow
                      key={`${r.medicationId}-${r.usualTime}`}
                      onPress={() => navigation.navigate('MedDetail', { id: r.medicationId })}
                      label={`${medName(r.medicationId)}, ${formatDose(r.dose)}, ${formatTime(r.time)}, ${status.word}${at ? ` at ${formatTime(at)}` : ''}. Opens details.`}
                    >
                      <View style={[styles.cell, styles.colMed]}>
                        <T size="body" bold>
                          {medName(r.medicationId)}
                        </T>
                        <T size="small">{formatDose(r.dose)}</T>
                      </View>
                      <View style={[styles.cell, styles.colTime]}>
                        <T size="body">{formatTime(r.time)}</T>
                        {r.time !== r.usualTime && <T size="small" color={colors.muted}>{`usually ${formatTime(r.usualTime)}`}</T>}
                      </View>
                      <View style={[styles.cell, styles.colTaken, styles.lastCell]}>
                        <T size="body" bold color={status.color}>{`${status.icon} ${status.word}`}</T>
                        {at && <T size="small">{formatTime(at)}</T>}
                      </View>
                    </TableRow>
                  );
                })}
              </View>
            );
          })}
        </Card>
      )}
      <Button label="Edit Meds" onPress={() => navigation.navigate('EditMeds')} />
    </Screen>
  );
}

function TableRow({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label: string }) {
  const steady = useSteadyPress(onPress);
  return (
    <Pressable onPress={steady} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.tr, pressed && { backgroundColor: colors.pineTint }]}>
      {children}
    </Pressable>
  );
}

// ---- Edit Meds: pick one to change, or add a new one ----

export function EditMedsScreen({ navigation }: ScreenProps<'EditMeds'>) {
  const medications = useApp((s) => s.medications);
  return (
    <Screen>
      <Heading>Edit Meds</Heading>
      <Card tint>
        <T size="large" bold color={colors.pine}>
          ↓ Pick one to change
        </T>
      </Card>
      {medications.map((m, i) => (
        <Button key={m.id} label={`${i + 1}. ${m.name}`} variant="outline" onPress={() => navigation.navigate('MedDetail', { id: m.id })} />
      ))}
      {medications.length === 0 && (
        <Card>
          <T size="large">No medications yet.</T>
        </Card>
      )}
      <Gap />
      <Button label="New Pill" icon={scanIcon} onPress={() => navigation.navigate('AddMedStart')} />
    </Screen>
  );
}

// ---- Medication details ----

export function MedDetailScreen({ navigation, route }: ScreenProps<'MedDetail'>) {
  const med = useApp((s) => s.medications.find((m) => m.id === route.params.id));
  const schedule = useApp((s) => s.schedules.find((x) => x.medicationId === route.params.id));
  if (!med) {
    return (
      <Screen>
        <Card>
          <T size="large">This medication was deleted.</T>
        </Card>
      </Screen>
    );
  }
  const edit = () => {
    useDraft.getState().reset();
    useDraft.getState().set({ id: med.id, name: med.name, strength: med.strength ?? '', notes: med.notes ?? '', times: schedule?.times ?? [] });
    navigation.navigate('AddMedType');
  };
  return (
    <Screen>
      <Card>
        <T size="title" bold accessibilityRole="header">
          {med.name}
        </T>
        {med.strength ? <T size="large">{med.strength}</T> : null}
        {med.notes ? <T size="body" color={colors.muted}>{med.notes}</T> : null}
        <Gap />
        <T size="large" bold>
          Usual times
        </T>
        {(schedule?.times ?? []).map((t) => (
          <T key={t.time} size="large">{`${formatTime(t.time)}: ${formatDose(t.dose)}`}</T>
        ))}
      </Card>
      <Button label="Edit" onPress={edit} />
      <Button label="Delete" variant="red" onPress={() => navigation.navigate('DeleteMed', { id: med.id })} />
    </Screen>
  );
}

export function DeleteMedScreen({ navigation, route }: ScreenProps<'DeleteMed'>) {
  const med = useApp((s) => s.medications.find((m) => m.id === route.params.id));
  const remove = async () => {
    useApp.getState().deleteMedication(route.params.id);
    await scheduleDoseNotifications().catch(() => {});
    await band.setReminders(todaysBandTimes());
    navigation.reset({ index: 1, routes: [{ name: 'Dashboard' }, { name: 'ManageMeds' }] });
  };
  return (
    <Screen>
      <Card>
        <T size="heading" bold accessibilityRole="header">{`Delete ${med?.name ?? 'this medication'}?`}</T>
        <Gap />
        <T size="large">Its reminders will stop. Doses already logged stay in your history.</T>
      </Card>
      <Button label="Yes, delete it" variant="red" onPress={remove} />
      <Button label="No, keep it" variant="outline" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  divider: { width: 4, alignSelf: 'stretch', backgroundColor: colors.text, borderRadius: 2 },
  // Table drawn as a full grid, like the Manage Meds mockup: 2 dp lines everywhere.
  table: { padding: 0, overflow: 'hidden', borderWidth: 2, borderColor: colors.text, borderRadius: 0 },
  tr: { flexDirection: 'row', alignItems: 'stretch', minHeight: TOUCH_TARGET + 8, borderBottomWidth: 2, borderBottomColor: colors.text },
  th: { backgroundColor: colors.pineTint },
  cell: { justifyContent: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRightWidth: 2, borderRightColor: colors.text },
  lastCell: { borderRightWidth: 0 },
  period: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.background, borderBottomWidth: 2, borderBottomColor: colors.text },
  colMed: { flex: 1.3 },
  colTime: { flex: 1 },
  colTaken: { flex: 1.35 },
});
