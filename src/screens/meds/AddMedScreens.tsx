// Add a medication, one step per screen: scan or type -> confirm -> times and doses -> summary -> done.

import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Image } from 'react-native';
import { band, todaysBandTimes } from '../../band';
import { Screen } from '../../components/Screen';
import { Button, Card, Gap, Heading, Row, Stepper, T, TextField } from '../../components/ui';
import { formatDose, formatTime, fromMinutes, newId, toMinutes } from '../../logic/time';
import { ScreenProps } from '../../navigation/types';
import { scanLabel } from '../../ocr/scanLabel';
import { scheduleDoseNotifications } from '../../services/notifications';
import { useDraft } from '../../state/draft';
import { useApp } from '../../state/store';
import { colors, spacing } from '../../theme/tokens';

const scanIcon = require('../../assets/scan_pills.png');

// ---- Step 1: scan or type ----

export function AddMedStartScreen({ navigation }: ScreenProps<'AddMedStart'>) {
  const draft = useDraft();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const readPhoto = async (uri: string) => {
    setBusy(true);
    const result = await scanLabel(uri);
    setBusy(false);
    draft.reset();
    if (result.ok) {
      draft.set({ name: result.label.name ?? '', strength: result.label.strength ?? '', labelDirections: result.label.directions, fromScan: true });
    } else {
      draft.set({ scanError: result.reason, fromScan: true });
    }
    navigation.navigate('AddMedConfirm');
  };

  const takePhoto = async () => {
    setProblem(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setProblem('Camera permission is off. You can choose a photo instead, or type the name.');
      return;
    }
    const photo = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!photo.canceled) await readPhoto(photo.assets[0].uri);
  };

  const choosePhoto = async () => {
    setProblem(null);
    const photo = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!photo.canceled) await readPhoto(photo.assets[0].uri);
  };

  const type = () => {
    draft.reset();
    navigation.navigate('AddMedType');
  };

  if (busy) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.pine} />
          <Gap />
          <T size="heading" bold center accessibilityRole="header">
            Reading the label…
          </T>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading>Add a medication</Heading>
      <Card style={{ alignItems: 'center' }}>
        <Image source={scanIcon} style={{ width: 110, height: 92 }} resizeMode="contain" accessibilityIgnoresInvertColors />
        <Gap size="sm" />
        <Button label="Scan pill bottle" onPress={takePhoto} style={{ alignSelf: 'stretch' }} accessibilityHint="Opens the camera to take a photo of the label" />
        <Button label="Choose a photo" variant="outline" size="normal" onPress={choosePhoto} style={{ alignSelf: 'stretch' }} />
        {problem && <T size="body" color={colors.red}>{problem}</T>}
      </Card>
      <Button label="Type it instead" variant="red" onPress={type} />
    </Screen>
  );
}

// ---- Step 2: confirm what the scan found ----

export function AddMedConfirmScreen({ navigation }: ScreenProps<'AddMedConfirm'>) {
  const { name, strength, scanError, labelDirections } = useDraft();

  if (scanError || !name) {
    return (
      <Screen>
        <Card>
          <Heading size="heading">The label couldn’t be read</Heading>
          <T size="large">{scanError ?? 'No medication name was found.'}</T>
          <Gap />
          <T size="body">Please type the name instead.</T>
        </Card>
        <Button label="Type it instead" onPress={() => navigation.replace('AddMedType')} />
        <Button label="Try another photo" variant="outline" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card style={{ alignItems: 'center' }}>
        <T size="large" center>
          The label says:
        </T>
        <Gap size="sm" />
        <T size="title" bold center accessibilityRole="header">
          {name}
        </T>
        {strength ? (
          <T size="heading" center>
            {strength}
          </T>
        ) : (
          <T size="body" center color={colors.muted}>
            No strength found
          </T>
        )}
        {labelDirections && (
          <>
            <Gap />
            <T size="body" center color={colors.muted}>{`Directions on label: ${labelDirections}`}</T>
          </>
        )}
      </Card>
      <Button label="Yes, that’s right" onPress={() => navigation.navigate('AddMedTimes')} />
      <Button label="Edit" variant="red" onPress={() => navigation.navigate('AddMedType')} />
    </Screen>
  );
}

// ---- Step 1b: type it ----

export function AddMedTypeScreen({ navigation }: ScreenProps<'AddMedType'>) {
  const draft = useDraft();
  const [name, setName] = useState(draft.name);
  const [strength, setStrength] = useState(draft.strength);
  const [notes, setNotes] = useState(draft.notes || draft.labelDirections || '');
  const next = () => {
    draft.set({ name: name.trim(), strength: strength.trim(), notes: notes.trim() });
    navigation.navigate('AddMedTimes');
  };
  return (
    <Screen>
      <Heading>{draft.id ? 'Edit medication' : 'Type the medication'}</Heading>
      <Card>
        <TextField label="Medication name" value={name} onChange={setName} placeholder="For example, Carbidopa/Levodopa" />
        <TextField label="Strength (optional)" value={strength} onChange={setStrength} placeholder="For example, 25/100 mg" />
        <TextField label="Notes (optional)" value={notes} onChange={setNotes} placeholder="For example, take with water" />
        <Button label="Next" onPress={next} disabled={!name.trim()} />
      </Card>
    </Screen>
  );
}

// ---- Step 3: times and doses ----

function pickTime(initial: string, onPicked: (time: string) => void) {
  const [h, m] = initial.split(':').map(Number);
  const value = new Date();
  value.setHours(h, m, 0, 0);
  // Android's tap-based clock dialog: no scrolling wheels or dragging.
  DateTimePickerAndroid.open({
    value,
    mode: 'time',
    is24Hour: false,
    onChange: (event, date) => {
      if (event.type === 'set' && date) onPicked(fromMinutes(date.getHours() * 60 + date.getMinutes()));
    },
  });
}

export function AddMedTimesScreen({ navigation }: ScreenProps<'AddMedTimes'>) {
  const draft = useDraft();
  const times = draft.times;
  const setTimes = (t: typeof times) => draft.set({ times: [...t].sort((a, b) => toMinutes(a.time) - toMinutes(b.time)) });

  const addTime = () => {
    const last = times[times.length - 1];
    const suggested = last ? fromMinutes(Math.min(toMinutes(last.time) + 4 * 60, 23 * 60)) : '08:00';
    pickTime(suggested, (time) => {
      if (times.some((t) => t.time === time)) return;
      setTimes([...times, { time, dose: last?.dose ?? 1 }]); // new rows copy the previous row's dose
    });
  };

  return (
    <Screen>
      <Heading>{`When do you take ${draft.name}?`}</Heading>
      {times.length === 0 && (
        <Card>
          <T size="large">Add each time of day you take it.</T>
        </Card>
      )}
      {times.map((t, i) => (
        <Card key={t.time}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T size="heading" bold>
              {formatTime(t.time)}
            </T>
            <Button
              label="Change time"
              variant="outline"
              size="normal"
              style={{ marginBottom: 0 }}
              onPress={() => pickTime(t.time, (time) => setTimes(times.map((x, k) => (k === i ? { ...x, time } : x))))}
            />
          </Row>
          <Gap size="sm" />
          <T size="body" bold>
            Dose
          </T>
          <Stepper
            label={`dose at ${formatTime(t.time)}`}
            value={t.dose}
            step={0.5}
            min={0.5}
            max={10}
            format={formatDose}
            onChange={(dose) => setTimes(times.map((x, k) => (k === i ? { ...x, dose } : x)))}
          />
          <Button label="Remove this time" variant="red" size="normal" onPress={() => setTimes(times.filter((_, k) => k !== i))} />
        </Card>
      ))}
      <Button label="+ Add a time" variant="outline" onPress={addTime} />
      <Button label="Next" onPress={() => navigation.navigate('AddMedSummary')} disabled={times.length === 0} />
    </Screen>
  );
}

// ---- Step 4: summary ----

export function AddMedSummaryScreen({ navigation }: ScreenProps<'AddMedSummary'>) {
  const draft = useDraft();
  const save = async () => {
    const id = draft.id ?? newId();
    useApp.getState().saveMedication({ id, name: draft.name, strength: draft.strength || undefined, notes: draft.notes || undefined }, draft.times);
    await scheduleDoseNotifications().catch(() => {});
    await band.setReminders(todaysBandTimes());
    navigation.reset({ index: 1, routes: [{ name: 'Dashboard' }, { name: 'AddMedDone' }] });
  };
  return (
    <Screen>
      <Heading>Check and save</Heading>
      <Card>
        <T size="heading" bold>
          {draft.name}
        </T>
        {draft.strength ? <T size="large">{draft.strength}</T> : null}
        {draft.notes ? <T size="body" color={colors.muted}>{draft.notes}</T> : null}
        <Gap />
        {draft.times.map((t) => (
          <T key={t.time} size="large" style={{ marginBottom: spacing.xs }}>{`${formatTime(t.time)}: ${formatDose(t.dose)}`}</T>
        ))}
      </Card>
      <Button label="Save" onPress={save} />
      <Button label="Back" variant="outline" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

// ---- Step 5: done ----

export function AddMedDoneScreen({ navigation }: ScreenProps<'AddMedDone'>) {
  const name = useDraft((d) => d.name);
  return (
    <Screen>
      <Card style={{ alignItems: 'center' }}>
        <T size="title" bold center color={colors.pine} accessibilityRole="header">
          ✓ Saved
        </T>
        <Gap />
        <T size="large" center>{`${name} is saved and your reminders are set.`}</T>
      </Card>
      <Button label="See my medications" onPress={() => navigation.replace('ManageMeds')} />
      <Button label="Add another" variant="outline" onPress={() => navigation.replace('AddMedStart')} />
      <Button label="Home" variant="outline" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })} />
    </Screen>
  );
}

