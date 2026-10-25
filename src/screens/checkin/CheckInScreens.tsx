import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { SmileyBadge, SmileyPicker } from '../../components/Smileys';
import { Button, Card, Choice, Gap, Heading, Row, Stepper, T, TextField, useSteadyPress } from '../../components/ui';
import { useNow } from '../../hooks/useNow';
import {
  compareToHistory,
  dayScore,
  hoursFromLongPresses,
  MAX_TRACKABLES,
  medsOnTimeScore,
  MIN_TRACKABLES,
  PRESET_TRACKABLES,
  SCORE_FACES,
  scoreAgainstGoal,
} from '../../logic/checkin';
import { dateKey, formatHour, newId } from '../../logic/time';
import { ScreenProps } from '../../navigation/types';
import { useCheckInDraft } from '../../state/checkinDraft';
import { useApp } from '../../state/store';
import { colors, RADIUS, spacing, BUTTON_HEIGHT } from '../../theme/tokens';
import { Trackable } from '../../types';
import { useListener } from '../../voice/speech';

// ---- Check-in home ----

export function CheckInHomeScreen({ navigation }: ScreenProps<'CheckInHome'>) {
  const now = useNow();
  const trackables = useApp((s) => s.trackables);
  const savedToday = useApp((s) => s.checkIns.some((c) => c.date === dateKey(now)));
  const start = () => {
    useCheckInDraft.getState().reset();
    if (trackables.length === 0) navigation.navigate('ChooseTrackables', { thenStart: true });
    else navigation.navigate('CheckInItem', { index: 0 });
  };
  return (
    <Screen>
      <Card style={{ alignItems: 'center' }}>
        <T size="clock" bold center>
          {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}
        </T>
        <Row>
          <Text style={{ fontSize: 48 }} accessibilityElementsHidden>
            {SCORE_FACES[5]}
          </Text>
          <T size="large" bold style={{ flexShrink: 1 }}>
            One Check-In Closer to a Better Day
          </T>
        </Row>
      </Card>
      {savedToday ? (
        <>
          <Card tint>
            <T size="large" bold color={colors.pine}>
              ✓ Today’s check-in is saved.
            </T>
          </Card>
          <Button label="See today’s summary" onPress={() => navigation.navigate('CheckInSummary')} />
          <Button label="Redo today’s check-in" variant="outline" onPress={start} />
        </>
      ) : (
        <Button label="Log Trackables" variant="red" onPress={start} accessibilityHint="Starts today’s check-in, one question per screen" />
      )}
      <Button label="Edit Trackables" onPress={() => navigation.navigate('ChooseTrackables')} />
      <Button label="View / Share Reports" variant="red" onPress={() => navigation.navigate('Reports')} />
    </Screen>
  );
}

// ---- Choose 5 to 10 trackables ----

export function ChooseTrackablesScreen({ navigation, route }: ScreenProps<'ChooseTrackables'>) {
  const saved = useApp((s) => s.trackables);
  const savedCustom = useApp((s) => s.customTrackables);
  const [custom, setCustom] = useState<Trackable[]>(savedCustom);
  const [chosen, setChosen] = useState<Trackable[]>(saved);
  const [warning, setWarning] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newUnit, setNewUnit] = useState('');

  const all = [...PRESET_TRACKABLES, ...custom];
  const isChosen = (id: string) => chosen.some((t) => t.id === id);

  const toggle = (t: Trackable) => {
    setWarning(null);
    if (isChosen(t.id)) setChosen(chosen.filter((c) => c.id !== t.id));
    else if (chosen.length >= MAX_TRACKABLES) setWarning(`You can choose up to ${MAX_TRACKABLES}. Remove one first.`);
    else setChosen([...chosen, t]);
  };
  const setGoal = (id: string, goal: number) => setChosen(chosen.map((c) => (c.id === id ? { ...c, goal } : c)));

  const addCustom = (kind: 'felt' | 'measured') => {
    const label = newLabel.trim();
    if (!label) return;
    const t: Trackable =
      kind === 'felt' ? { id: `custom-${newId()}`, label, kind } : { id: `custom-${newId()}`, label, kind, unit: newUnit.trim() || 'times', goal: 10, step: 1 };
    setCustom([...custom, t]);
    if (chosen.length < MAX_TRACKABLES) setChosen([...chosen, t]);
    setNewLabel('');
    setNewUnit('');
  };

  const save = () => {
    // Keep the order of the list, so the check-in always asks in the same order.
    const ordered = all.filter((t) => isChosen(t.id)).map((t) => chosen.find((c) => c.id === t.id)!);
    useApp.getState().setTrackables(ordered, custom);
    if (route.params?.thenStart) navigation.replace('CheckInItem', { index: 0 });
    else navigation.goBack();
  };

  const ok = chosen.length >= MIN_TRACKABLES && chosen.length <= MAX_TRACKABLES;

  return (
    <Screen
      footer={<Button label={`Save (${chosen.length} of ${MAX_TRACKABLES} chosen)`} onPress={save} disabled={!ok} />}
    >
      <Heading>Choose what to track</Heading>
      <Card tint>
        <T size="large" bold color={colors.pine} accessibilityLiveRegion="polite">{`${chosen.length} of ${MAX_TRACKABLES} chosen`}</T>
        <T size="body">{`Pick ${MIN_TRACKABLES} to ${MAX_TRACKABLES}. You can change goals for the ones you measure.`}</T>
        {warning && <T size="body" bold color={colors.red}>{warning}</T>}
      </Card>
      {(['measured', 'felt', 'auto'] as const).map((kind) => (
        <View key={kind}>
          <T size="large" bold accessibilityRole="header" style={{ marginVertical: spacing.sm }}>
            {kind === 'measured' ? 'Things you measure' : kind === 'felt' ? 'How you feel' : 'Automatic'}
          </T>
          {all
            .filter((t) => t.kind === kind)
            .map((t) => {
              const c = chosen.find((x) => x.id === t.id);
              return (
                <View key={t.id}>
                  <Choice
                    label={t.label}
                    selected={!!c}
                    onPress={() => toggle(t)}
                    detail={t.kind === 'measured' ? `Goal: ${(c ?? t).goal} ${t.unit}` : t.kind === 'auto' ? 'From your dose log' : 'Rated with smileys'}
                  />
                  {c && c.kind === 'measured' && (
                    <Card style={{ marginTop: -spacing.xs }}>
                      <T size="body" bold>{`Goal for ${c.label}`}</T>
                      <Stepper label={`goal for ${c.label}`} value={c.goal ?? 1} step={c.step ?? 1} min={c.step ?? 1} max={1000} format={(v) => `${v} ${c.unit}`} onChange={(v) => setGoal(c.id, v)} />
                    </Card>
                  )}
                </View>
              );
            })}
        </View>
      ))}
      <Card>
        <T size="large" bold accessibilityRole="header">
          Add your own
        </T>
        <Gap size="sm" />
        <TextField label="Name" value={newLabel} onChange={setNewLabel} placeholder="For example, Walking" />
        <TextField label="Unit, if you measure it" value={newUnit} onChange={setNewUnit} placeholder="For example, steps or minutes" />
        <Button label="Add as a feeling (smileys)" size="normal" variant="outline" onPress={() => addCustom('felt')} disabled={!newLabel.trim()} />
        <Button label="Add as a number" size="normal" variant="outline" onPress={() => addCustom('measured')} disabled={!newLabel.trim()} />
      </Card>
    </Screen>
  );
}

// ---- One trackable per screen ----

export function CheckInItemScreen({ navigation, route }: ScreenProps<'CheckInItem'>) {
  const { index } = route.params;
  const trackables = useApp((s) => s.trackables);
  const day = useApp((s) => s.day);
  const doseLogs = useApp((s) => s.doseLogs);
  const draft = useCheckInDraft();
  const t = trackables[index];
  const existing = t ? draft.entries[t.id] : undefined;
  const [value, setValue] = useState<number>(existing?.value ?? 0);
  const [override, setOverride] = useState<number | undefined>(existing && t?.kind === 'measured' ? existing.score : undefined);
  const [felt, setFelt] = useState<number | undefined>(t?.kind === 'felt' ? existing?.score : undefined);
  const auto = useMemo(() => (t?.kind === 'auto' ? medsOnTimeScore(day.reminders, doseLogs, day.date, new Date()) : undefined), [t, day, doseLogs]);

  const goNext = () => {
    if (index + 1 < trackables.length) navigation.push('CheckInItem', { index: index + 1 });
    else navigation.navigate('OffHours');
  };

  if (!t) return null;

  const measuredScore = t.kind === 'measured' ? override ?? scoreAgainstGoal(value, t.goal ?? 1) : undefined;

  const next = () => {
    if (t.kind === 'measured') draft.setEntry({ trackableId: t.id, value, score: measuredScore!, source: 'entered' });
    if (t.kind === 'felt' && felt) draft.setEntry({ trackableId: t.id, score: felt, source: 'entered' });
    if (t.kind === 'auto' && auto) draft.setEntry({ trackableId: t.id, score: auto.score, source: 'auto' });
    goNext();
  };
  const skip = () => {
    draft.skip(t.id);
    goNext();
  };
  const canGoOn = t.kind === 'measured' || (t.kind === 'felt' && !!felt) || t.kind === 'auto';

  return (
    <Screen footer={<Button label="Next" onPress={next} disabled={!canGoOn} />}>
      <T size="body" bold center color={colors.muted}>{`${index + 1} of ${trackables.length}`}</T>
      <Heading>{t.label}</Heading>

      {t.kind === 'measured' && (
        <>
          <Card>
            <Stepper label={t.label} value={value} step={t.step ?? 1} min={0} max={10000} format={(v) => `${v} ${t.unit}`} onChange={(v) => { setValue(v); setOverride(undefined); }} />
            <T size="large" center>{`Goal: ${t.goal} ${t.unit}`}</T>
          </Card>
          <Card>
            <T size="body" bold>
              Score (tap a different face if this doesn’t fit)
            </T>
            <Gap size="sm" />
            <SmileyPicker label={`Score for ${t.label}`} value={measuredScore} onChange={setOverride} />
          </Card>
        </>
      )}

      {t.kind === 'felt' && (
        <Card>
          <T size="large" bold>{`How was your ${t.label.toLowerCase()} today?`}</T>
          <Gap size="sm" />
          <SmileyPicker label={`How was your ${t.label}`} value={felt} onChange={setFelt} />
        </Card>
      )}

      {t.kind === 'auto' && (
        <Card style={{ alignItems: 'center' }}>
          {auto ? (
            <>
              <T size="heading" bold center>{`Medications on time: ${auto.onTime} of ${auto.total}`}</T>
              <Gap size="sm" />
              <SmileyBadge score={auto.score} />
              <Gap size="sm" />
              <T size="small" color={colors.muted} center>
                From your dose log. Within 15 minutes counts as on time.
              </T>
            </>
          ) : (
            <T size="large" center>
              No doses were due yet today. This one will be skipped.
            </T>
          )}
        </Card>
      )}

      <Button label="Skip this one" variant="outline" onPress={skip} />
    </Screen>
  );
}

// ---- When did you feel off today? ----

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM to 10 PM

export function OffHoursScreen({ navigation }: ScreenProps<'OffHours'>) {
  const draft = useCheckInDraft();
  const presses = useApp((s) => s.metronomeStarts);
  const today = dateKey(new Date());
  const bandHours = useMemo(() => hoursFromLongPresses(presses.map((p) => p.timestamp), today), [presses, today]);
  const [selected, setSelected] = useState<number[]>(draft.offHours.length ? draft.offHours : bandHours);

  const toggle = (h: number) => setSelected(selected.includes(h) ? selected.filter((x) => x !== h) : [...selected, h].sort((a, b) => a - b));
  const next = () => {
    draft.set({ offHours: selected });
    navigation.navigate('CheckInNotes');
  };
  const none = () => {
    draft.set({ offHours: [] });
    navigation.navigate('CheckInNotes');
  };

  return (
    <Screen simulatedBand={bandHours.length > 0} footer={<Button label="Next" onPress={next} />}>
      <Heading>When did you feel off today?</Heading>
      {bandHours.length > 0 && (
        <Card tint>
          <T size="body" bold>
            {`Your band’s metronome was used at ${bandHours.map(formatHour).join(', ')}. Those hours are marked ♪ and already chosen. Keep or remove them.`}
          </T>
        </Card>
      )}
      <View style={styles.grid}>
        {HOURS.map((h) => (
          <HourButton key={h} hour={h} selected={selected.includes(h)} fromBand={bandHours.includes(h)} onPress={() => toggle(h)} />
        ))}
      </View>
      <Gap />
      <Button label="None, I felt fine" variant="outline" onPress={none} />
    </Screen>
  );
}

function HourButton({ hour, selected, fromBand, onPress }: { hour: number; selected: boolean; fromBand: boolean; onPress: () => void }) {
  const steady = useSteadyPress(onPress);
  return (
    <Pressable
      onPress={steady}
      accessibilityRole="checkbox"
      accessibilityLabel={`${formatHour(hour)}${fromBand ? ', metronome used' : ''}`}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [styles.hour, selected && styles.hourSelected, pressed && { opacity: 0.85 }]}
    >
      <T size="large" bold color={selected ? colors.white : colors.text}>
        {`${selected ? '✓ ' : ''}${formatHour(hour)}${fromBand ? ' ♪' : ''}`}
      </T>
    </Pressable>
  );
}

// ---- Notes and overall ----

export function CheckInNotesScreen({ navigation }: ScreenProps<'CheckInNotes'>) {
  const draft = useCheckInDraft();
  const [note, setNote] = useState(draft.note);
  const [overall, setOverall] = useState<number | undefined>(draft.overall);
  const dictation = useListener('notes', {
    continuous: true,
    onFinal: (text) => setNote((n) => (n ? `${n} ${text}` : text)),
  });

  const save = () => {
    dictation.cancel();
    const state = useApp.getState();
    const entries = state.trackables.map((t) => draft.entries[t.id]).filter((e) => !!e);
    const date = dateKey(new Date());
    state.saveCheckIn({
      id: newId(),
      date,
      entries,
      offHours: draft.offHours,
      overall,
      note: note.trim() || undefined,
      dayScore: dayScore(entries),
    });
    draft.reset();
    navigation.reset({ index: 1, routes: [{ name: 'Dashboard' }, { name: 'CheckInSummary' }] });
  };

  return (
    <Screen footer={<Button label="Save" onPress={save} />}>
      <Heading>Notes</Heading>
      <Card>
        <TextField label="Anything to remember about today? (optional)" value={note} onChange={setNote} multiline placeholder="Type here, or tap Speak a note" />
        {dictation.listening ? (
          <>
            <T size="body" bold color={colors.red} accessibilityLiveRegion="polite">
              {`● Listening… ${dictation.transcript}`}
            </T>
            <Button label="Stop" variant="red" onPress={dictation.stop} />
          </>
        ) : (
          <Button label="🎤 Speak a note" variant="outline" onPress={dictation.start} />
        )}
        {dictation.error && <T size="body" color={colors.red}>{dictation.error}</T>}
        <T size="small" color={colors.muted}>
          You can fix any words in the box after speaking.
        </T>
      </Card>
      <Card>
        <T size="large" bold accessibilityRole="header">
          Overall, how was today?
        </T>
        <Gap size="sm" />
        <SmileyPicker label="Overall, how was today" value={overall} onChange={setOverall} />
      </Card>
    </Screen>
  );
}

// ---- Summary ----

export function CheckInSummaryScreen({ navigation }: ScreenProps<'CheckInSummary'>) {
  const checkIns = useApp((s) => s.checkIns);
  const chosen = useApp((s) => s.trackables);
  const custom = useApp((s) => s.customTrackables);
  const trackables = [...chosen, ...custom, ...PRESET_TRACKABLES]; // chosen first: it has the person's goals
  const today = checkIns.find((c) => c.date === dateKey(new Date()));
  if (!today) {
    return (
      <Screen>
        <Card>
          <T size="large">No check-in saved today yet.</T>
        </Card>
      </Screen>
    );
  }
  const comparison = compareToHistory(today, checkIns);
  return (
    <Screen>
      <Card style={{ alignItems: 'center' }}>
        <T size="title" bold center accessibilityRole="header">{`Score: ${today.dayScore} out of 100`}</T>
        {comparison && <T size="large" center>{comparison}</T>}
      </Card>
      <Card>
        {today.entries.map((e) => {
          const t = trackables.find((x) => x.id === e.trackableId);
          return (
            <Row key={e.trackableId} style={styles.summaryRow}>
              <View style={{ flex: 1 }}>
                <T size="large" bold>
                  {t?.label ?? e.trackableId}
                </T>
                {t?.kind === 'measured' && <T size="body">{`${e.value} of ${t.goal} ${t.unit}`}</T>}
                {t?.kind === 'auto' && <T size="body">From dose log</T>}
              </View>
              <SmileyBadge score={e.score} />
            </Row>
          );
        })}
        {today.overall && (
          <Row style={styles.summaryRow}>
            <T size="large" bold style={{ flex: 1 }}>
              Overall
            </T>
            <SmileyBadge score={today.overall} />
          </Row>
        )}
        <T size="body" style={{ marginTop: spacing.sm }}>{`Felt off: ${today.offHours.length ? today.offHours.map(formatHour).join(', ') : 'None'}`}</T>
        {today.note && <T size="body">{`Notes: ${today.note}`}</T>}
      </Card>
      <Button label="Done" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })} />
      <Button label="Share today’s report" variant="red" onPress={() => navigation.navigate('Reports')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hour: {
    width: '48%',
    minHeight: BUTTON_HEIGHT,
    borderRadius: RADIUS,
    borderWidth: 3,
    borderColor: colors.pine,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourSelected: { backgroundColor: colors.pine },
  summaryRow: { borderBottomWidth: 1, borderBottomColor: colors.muted, paddingVertical: spacing.sm },
});
