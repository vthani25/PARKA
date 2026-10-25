import React, { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Button, Card, Choice, Gap, Heading, T, TextField } from '../components/ui';
import { useNow } from '../hooks/useNow';
import { nextReminder } from '../logic/reminders';
import { DEVICE_NOTE, FLAG_LABELS, HOSPITAL_ALERT, HOSPITAL_POINTS, hospitalCardHtml, hospitalMedRows } from '../logic/reports';
import { formatTime, timeOf } from '../logic/time';
import { ScreenProps } from '../navigation/types';
import { reportData, sharePdf } from '../services/share';
import { medicationName, useApp } from '../state/store';
import { colors, spacing } from '../theme/tokens';
import { HospitalCard } from '../types';

/** "Last dose logged" and "Next due", live from the dose log and today's reminders. */
function useDoseStatus() {
  const now = useNow();
  const doseLogs = useApp((s) => s.doseLogs);
  const day = useApp((s) => s.day);
  const last = [...doseLogs].sort((a, b) => b.loggedAt - a.loggedAt)[0];
  const next = nextReminder(day.reminders, timeOf(now));
  const lastDose = last
    ? `${medicationName(last.medicationId)} at ${formatTime(timeOf(new Date(last.loggedAt)))}${new Date(last.loggedAt).toDateString() === now.toDateString() ? ' today' : ` on ${new Date(last.loggedAt).toLocaleDateString('en-US')}`}`
    : 'None logged';
  const nextDue = next ? `${medicationName(next.medicationId)} at ${formatTime(next.time)}` : 'No more doses today';
  return { lastDose, nextDue };
}

export function HospitalCardScreen({ navigation }: ScreenProps<'HospitalCard'>) {
  const card = useApp((s) => s.hospitalCard);
  useApp((s) => s.schedules); // re-render when medications change
  const rows = hospitalMedRows(reportData());
  const { lastDose, nextDue } = useDoseStatus();
  const [error, setError] = useState<string | null>(null);
  const flags = (Object.keys(FLAG_LABELS) as (keyof HospitalCard['flags'])[]).filter((k) => card.flags[k]);

  const share = async () => {
    setError(null);
    try {
      await sharePdf(hospitalCardHtml(card, rows, lastDose, nextDue), 'Hospital card');
    } catch {
      setError('The PDF could not be shared.');
    }
  };

  const Field = ({ label, value }: { label: string; value?: string }) =>
    value ? (
      <View style={styles.field}>
        <T size="small" bold color={colors.muted}>
          {label}
        </T>
        <T size="large">{value}</T>
      </View>
    ) : null;

  return (
    <Screen>
      <Card style={styles.alert}>
        <T size="large" bold color={colors.red} accessibilityRole="header">
          {HOSPITAL_ALERT}
        </T>
      </Card>
      <Card>
        {HOSPITAL_POINTS.map((p) => (
          <T key={p} size="body" style={{ marginBottom: spacing.sm }}>{`• ${p}`}</T>
        ))}
        <Button label="Parkinson.org/HospitalSafety" variant="outline" size="normal" onPress={() => Linking.openURL('https://www.parkinson.org/hospitalsafety')} />
        <Button label="Call 1-800-4PD-INFO" variant="outline" size="normal" onPress={() => Linking.openURL('tel:18004734636')} />
      </Card>

      <Card>
        <Heading size="heading">About me</Heading>
        {!card.patientName && <T size="body" color={colors.muted}>Tap Edit to fill in your card.</T>}
        <Field label="Name" value={card.patientName} />
        <Field label="Year diagnosed" value={card.diagnosedYear} />
        <Field label="Home address" value={card.homeAddress} />
        <Field label="Emergency contact" value={[card.careContact.name, card.careContact.phone].filter(Boolean).join(', ')} />
        <Field label="Parkinson’s doctor" value={[card.parkinsonsDoctor.name, card.parkinsonsDoctor.phone].filter(Boolean).join(', ')} />
        <Field label="Primary doctor" value={card.primaryDoctor} />
        <Field label="Pharmacy" value={card.pharmacy} />
        <Field label="Allergies" value={card.allergies || 'None listed'} />
        <Field label="Other conditions" value={card.otherConditions} />
        {flags.length > 0 && <Field label="Please note" value={flags.map((f) => FLAG_LABELS[f]).join(', ')} />}
        {(card.flags.dbs || card.flags.deliveryDevice) && (
          <Card style={styles.alert}>
            <T size="body" bold>
              {DEVICE_NOTE}
            </T>
          </Card>
        )}
        <Button label="Edit" onPress={() => navigation.navigate('HospitalCardEdit')} />
      </Card>

      <Card>
        <Heading size="heading">Medications</Heading>
        {rows.length === 0 && <T size="body">No medications entered yet.</T>}
        {rows.map((r, i) => (
          <View key={i} style={styles.medRow} accessible accessibilityLabel={`${r.time}, ${r.medication}, ${r.dose}${r.notes ? `, ${r.notes}` : ''}`}>
            <T size="body" bold style={{ width: 96 }}>
              {r.time}
            </T>
            <View style={{ flex: 1 }}>
              <T size="body" bold>
                {r.medication}
              </T>
              <T size="body">{r.dose}</T>
              {r.notes ? <T size="small" color={colors.muted}>{r.notes}</T> : null}
            </View>
          </View>
        ))}
        <Gap />
        <T size="large">
          <T size="large" bold>
            Last dose logged:{' '}
          </T>
          {lastDose}
        </T>
        <T size="large">
          <T size="large" bold>
            Next due:{' '}
          </T>
          {nextDue}
        </T>
      </Card>

      <Button label="Share PDF" variant="red" onPress={share} />
      {error && <T size="body" color={colors.red}>{error}</T>}
      <Card>
        <T size="small">Patient-provided information. Hospital to verify medications with the prescriber and pharmacist.</T>
        <Gap size="sm" />
        <T size="small" bold>
          Tip: Also set up Medical ID on your phone.
        </T>
        <Gap size="sm" />
        <T size="small" color={colors.muted}>
          Based on the Parkinson’s Foundation Medical Alert Card.
        </T>
      </Card>
    </Screen>
  );
}

export function HospitalCardEditScreen({ navigation }: ScreenProps<'HospitalCardEdit'>) {
  const saved = useApp((s) => s.hospitalCard);
  const [c, setC] = useState<HospitalCard>(saved);
  const set = (patch: Partial<HospitalCard>) => setC({ ...c, ...patch });
  const save = () => {
    useApp.getState().saveHospitalCard(c);
    navigation.goBack();
  };
  return (
    <Screen footer={<Button label="Save" onPress={save} />}>
      <Heading>Edit hospital card</Heading>
      <Card>
        <TextField label="Name" value={c.patientName} onChange={(v) => set({ patientName: v })} />
        <TextField label="Year diagnosed" value={c.diagnosedYear ?? ''} onChange={(v) => set({ diagnosedYear: v })} keyboardType="number-pad" />
        <TextField label="Home address (optional)" value={c.homeAddress ?? ''} onChange={(v) => set({ homeAddress: v })} />
      </Card>
      <Card>
        <TextField label="Emergency contact name" value={c.careContact.name} onChange={(v) => set({ careContact: { ...c.careContact, name: v } })} />
        <TextField label="Emergency contact phone" value={c.careContact.phone} onChange={(v) => set({ careContact: { ...c.careContact, phone: v } })} keyboardType="phone-pad" />
        <TextField label="Parkinson’s doctor" value={c.parkinsonsDoctor.name} onChange={(v) => set({ parkinsonsDoctor: { ...c.parkinsonsDoctor, name: v } })} />
        <TextField label="Parkinson’s doctor phone" value={c.parkinsonsDoctor.phone} onChange={(v) => set({ parkinsonsDoctor: { ...c.parkinsonsDoctor, phone: v } })} keyboardType="phone-pad" />
        <TextField label="Primary doctor (optional)" value={c.primaryDoctor ?? ''} onChange={(v) => set({ primaryDoctor: v })} />
        <TextField label="Pharmacy (optional)" value={c.pharmacy ?? ''} onChange={(v) => set({ pharmacy: v })} />
      </Card>
      <Card>
        <TextField label="Allergies" value={c.allergies} onChange={(v) => set({ allergies: v })} multiline />
        <TextField label="Other conditions" value={c.otherConditions} onChange={(v) => set({ otherConditions: v })} multiline />
      </Card>
      <Card>
        <T size="large" bold accessibilityRole="header">
          Check all that apply
        </T>
        <Gap size="sm" />
        {(Object.keys(FLAG_LABELS) as (keyof HospitalCard['flags'])[]).map((k) => (
          <Choice key={k} label={FLAG_LABELS[k]} selected={c.flags[k]} onPress={() => set({ flags: { ...c.flags, [k]: !c.flags[k] } })} />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  alert: { borderWidth: 4, borderColor: colors.red },
  field: { marginBottom: spacing.md },
  medRow: { flexDirection: 'row', gap: spacing.sm, borderBottomWidth: 2, borderBottomColor: colors.text, paddingVertical: spacing.sm },
});
