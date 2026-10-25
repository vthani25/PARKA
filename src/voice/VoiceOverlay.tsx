import React, { createContext, ReactNode, useContext, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, T, useSteadyPress } from '../components/ui';
import { goTo } from '../navigation/types';
import { confirmAwake, logDoseNow } from '../services/actions';
import { colors, RADIUS, spacing, TOUCH_TARGET } from '../theme/tokens';
import { COMMANDS, Match, matchCommand, VoiceAction } from './matchCommand';
import { say, useListener } from './speech';

const micIcon = require('../assets/voice_icon.png');

const NOT_CAUGHT = "I didn't catch that. Please say it again.";

const VoiceContext = createContext<{ open: () => void }>({ open: () => {} });

/** Mic button, bottom left on every screen. */
export function MicButton() {
  const { open } = useContext(VoiceContext);
  const onPress = useSteadyPress(open);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Voice command" accessibilityHint="Say what you want to do" style={styles.mic}>
      <Image source={micIcon} style={{ width: 52, height: 52 }} />
    </Pressable>
  );
}

/** Carry out a matched action. */
async function runAction(action: VoiceAction): Promise<string | undefined> {
  switch (action) {
    case 'go_home':
      goTo('Dashboard');
      return;
    case 'open_medications':
      goTo('ManageMeds');
      return;
    case 'add_medication':
      goTo('AddMedStart');
      return;
    case 'open_checkin':
      goTo('CheckInHome');
      return;
    case 'show_hospital_card':
      goTo('HospitalCard');
      return;
    case 'open_settings':
      goTo('Settings');
      return;
    case 'im_awake':
      return confirmAwake();
    case 'log_dose':
      return logDoseNow('app');
  }
}

type Phase = 'listening' | 'confirm' | 'refused' | 'result';

export function VoiceProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<Phase>('listening');
  const [match, setMatch] = useState<Match | null>(null);
  const [message, setMessage] = useState('');

  const listener = useListener('commands', {
    alternatives: 3,
    onFinal: (text, alternatives) => handleSpeech([text, ...alternatives]),
    onNothingHeard: () => refuse(),
  });

  function refuse() {
    setPhase('refused');
    say(NOT_CAUGHT);
  }

  async function handleSpeech(guesses: string[]) {
    // Use the first of the recognizer's guesses that is a clear command.
    let found: Match | null = null;
    for (const g of guesses) {
      found = matchCommand(g);
      if (found) break;
    }
    if (!found) return refuse();
    setMatch(found);
    if (found.changesData) {
      // Read the action back before changing any data.
      setPhase('confirm');
      say(`${found.label}. Is that right?`);
      return;
    }
    say(found.label);
    await runAction(found.action);
    close();
  }

  async function confirm() {
    if (!match) return;
    const result = await runAction(match.action);
    setMessage(result ?? 'Done.');
    setPhase('result');
    say(result ?? 'Done.');
  }

  function open() {
    setVisible(true);
    setPhase('listening');
    setMatch(null);
    listener.start();
  }

  function tryAgain() {
    setPhase('listening');
    setMatch(null);
    listener.start();
  }

  function close() {
    listener.cancel();
    setVisible(false);
  }

  return (
    <VoiceContext.Provider value={{ open }}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} accessibilityViewIsModal>
            {phase === 'listening' && (
              <>
                <T size="large" bold center>
                  {listener.listening ? 'Listening…' : 'Starting…'}
                </T>
                <View style={styles.transcript} accessibilityLiveRegion="polite">
                  <T size="heading" bold center>
                    {listener.transcript ? `“${listener.transcript}”` : 'Say a command, like “open medications”.'}
                  </T>
                </View>
                <CommandList />
                {listener.error && (
                  <T size="body" color={colors.red} center>
                    {listener.error}
                  </T>
                )}
                <Button label="Done talking" onPress={listener.stop} />
                <Button label="Cancel" variant="outline" onPress={close} />
              </>
            )}

            {phase === 'confirm' && match && (
              <>
                <T size="body" center color={colors.muted}>{`I heard “${listener.transcript}”`}</T>
                <T size="heading" bold center style={{ marginVertical: spacing.lg }} accessibilityRole="header">
                  {`${match.label}. Is that right?`}
                </T>
                <Button label="Yes" onPress={confirm} />
                <Button label="No" variant="red" onPress={tryAgain} />
              </>
            )}

            {phase === 'refused' && (
              <>
                {listener.transcript ? <T size="body" center color={colors.muted}>{`I heard “${listener.transcript}”`}</T> : null}
                <T size="heading" bold center style={{ marginVertical: spacing.md }} accessibilityLiveRegion="assertive">
                  {NOT_CAUGHT}
                </T>
                <CommandList />
                <Button label="Try again" onPress={tryAgain} />
                <Button label="Close" variant="outline" onPress={close} />
              </>
            )}

            {phase === 'result' && (
              <>
                <T size="heading" bold center style={{ marginVertical: spacing.lg }} accessibilityLiveRegion="polite">
                  {message}
                </T>
                <Button label="Close" onPress={close} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </VoiceContext.Provider>
  );
}

/** What you can say. Shown while listening and after an unclear command. */
function CommandList() {
  return (
    <View style={styles.commands}>
      <T size="body" bold>
        You can say:
      </T>
      <T size="body">{COMMANDS.map((c) => `“${c.label}”`).join('  ·  ')}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  commands: { backgroundColor: colors.pineTint, borderRadius: RADIUS, padding: spacing.md, marginBottom: spacing.md },
  mic: {
    width: TOUCH_TARGET + 8,
    height: TOUCH_TARGET + 8,
    borderRadius: (TOUCH_TARGET + 8) / 2,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: RADIUS * 2, borderTopRightRadius: RADIUS * 2, padding: spacing.lg },
  transcript: { minHeight: 90, justifyContent: 'center', marginVertical: spacing.sm },
});
