import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SCORE_FACES, SCORE_WORDS } from '../logic/checkin';
import { colors, RADIUS, spacing, BUTTON_HEIGHT } from '../theme/tokens';
import { T, useSteadyPress } from './ui';

/** Five large smileys, each with its number and word ("1 Very bad" to "5 Very good"). */
export function SmileyPicker({ value, onChange, label }: { value?: number; onChange: (score: number) => void; label: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label}>
      {[5, 4, 3, 2, 1].map((score) => (
        <SmileyOption key={score} score={score} selected={value === score} onPress={() => onChange(score)} />
      ))}
    </View>
  );
}

function SmileyOption({ score, selected, onPress }: { score: number; selected: boolean; onPress: () => void }) {
  const steady = useSteadyPress(onPress);
  return (
    <Pressable
      onPress={steady}
      accessibilityRole="radio"
      accessibilityLabel={`${score}, ${SCORE_WORDS[score]}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.option, selected && styles.selected, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.face}>{SCORE_FACES[score]}</Text>
      <T size="large" bold={selected} style={{ flex: 1 }}>{`${score}  ${SCORE_WORDS[score]}`}</T>
      {selected && (
        <T size="large" bold color={colors.pine}>
          ✓
        </T>
      )}
    </Pressable>
  );
}

/** A smiley with its word, for summaries. */
export function SmileyBadge({ score }: { score: number }) {
  return (
    <View style={styles.badge} accessible accessibilityLabel={`${score} of 5, ${SCORE_WORDS[score]}`}>
      <Text style={styles.badgeFace}>{SCORE_FACES[score]}</Text>
      <T size="small" bold>
        {SCORE_WORDS[score]}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: BUTTON_HEIGHT + 4,
    paddingHorizontal: spacing.md,
    borderRadius: RADIUS,
    borderWidth: 2,
    borderColor: colors.muted,
    backgroundColor: colors.card,
    marginBottom: spacing.sm,
  },
  selected: { borderWidth: 4, borderColor: colors.pine, backgroundColor: colors.pineTint },
  face: { fontSize: 40 },
  badge: { alignItems: 'center', minWidth: 90 },
  badgeFace: { fontSize: 32 },
});
