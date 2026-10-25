// Shared building blocks. Every control here follows the accessibility rules:
// at least 56 dp, fires on release, ignores repeat taps for 400 ms, has an accessibility label,
// and never needs a swipe, drag or long press.

import React, { ReactNode, useCallback, useRef } from 'react';
import { Image, ImageSourcePropType, KeyboardTypeOptions, Pressable, StyleProp, StyleSheet, Text, TextInput, TextStyle, View, ViewStyle } from 'react-native';
import { useApp } from '../state/store';
import { BUTTON_HEIGHT, colors, fonts, RADIUS, REPEAT_TAP_MS, spacing, textSizes, TOUCH_TARGET } from '../theme/tokens';

/** Wrap a handler so taps closer together than 400 ms are ignored. */
export function useSteadyPress(onPress?: () => void) {
  const last = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now - last.current < REPEAT_TAP_MS) return;
    last.current = now;
    onPress?.();
  }, [onPress]);
}

export function useTextSize(size: keyof typeof textSizes) {
  const scale = useApp((s) => s.settings.fontScale);
  return Math.round(textSizes[size] * scale);
}

type TextProps = {
  children: ReactNode;
  size?: keyof typeof textSizes;
  bold?: boolean;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  accessibilityRole?: 'header' | 'text';
  /** Announce changes to screen readers (for results and live transcription). */
  accessibilityLiveRegion?: 'polite' | 'assertive';
  numberOfLines?: number;
};

export function T({ children, size = 'body', bold, color, center, style, accessibilityRole, accessibilityLiveRegion, numberOfLines }: TextProps) {
  const fontSize = useTextSize(size);
  const highContrast = useApp((s) => s.settings.highContrast);
  const textColor = color ?? (highContrast ? colors.black : colors.text);
  return (
    <Text
      accessibilityRole={accessibilityRole}
      accessibilityLiveRegion={accessibilityLiveRegion}
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={1.3}
      style={[
        { fontFamily: bold ? fonts.bold : fonts.regular, fontSize, lineHeight: Math.round(fontSize * 1.3), color: textColor },
        center && { textAlign: 'center' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Heading({ children, size = 'title' }: { children: ReactNode; size?: keyof typeof textSizes }) {
  return (
    <T size={size} bold center accessibilityRole="header" style={{ marginBottom: spacing.md }}>
      {children}
    </T>
  );
}

/** Solid card. Text always sits on a card, never on the sky background. */
export function Card({ children, style, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: boolean }) {
  const highContrast = useApp((s) => s.settings.highContrast);
  return (
    <View
      style={[
        styles.card,
        tint && { backgroundColor: colors.pineTint },
        highContrast && { borderWidth: 3, borderColor: colors.black },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'pine' | 'red' | 'outline';
  icon?: ImageSourcePropType;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  size?: 'large' | 'normal';
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'pine', icon, accessibilityLabel, accessibilityHint, disabled, size = 'large', style }: ButtonProps) {
  const steady = useSteadyPress(onPress);
  const highContrast = useApp((s) => s.settings.highContrast);
  const bg = variant === 'pine' ? colors.pine : variant === 'red' ? colors.red : colors.card;
  const fg = variant === 'outline' ? colors.pine : colors.white;
  return (
    <Pressable
      onPress={steady}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, minHeight: size === 'large' ? BUTTON_HEIGHT : TOUCH_TARGET },
        variant === 'outline' && { borderWidth: 3, borderColor: colors.pine },
        highContrast && { borderWidth: 3, borderColor: colors.black },
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {icon && <Image source={icon} style={styles.buttonIcon} resizeMode="contain" accessibilityIgnoresInvertColors />}
      <T size={size === 'large' ? 'large' : 'body'} bold color={fg} center style={{ flexShrink: 1 }}>
        {label}
      </T>
    </Pressable>
  );
}

/** Big plus and minus buttons around a value. No sliders. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  format = String,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  label: string;
}) {
  const round = (v: number) => Math.round(v * 100) / 100;
  const minus = useSteadyPress(() => onChange(round(Math.max(min, value - step))));
  const plus = useSteadyPress(() => onChange(round(Math.min(max, value + step))));
  return (
    <View style={styles.stepper} accessible={false}>
      <RoundButton symbol="−" color={colors.red} onPress={minus} label={`Less ${label}`} disabled={value <= min} />
      <View style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${label}: ${format(value)}`}>
        <T size="heading" bold center>
          {format(value)}
        </T>
      </View>
      <RoundButton symbol="+" color={colors.pine} onPress={plus} label={`More ${label}`} disabled={value >= max} />
    </View>
  );
}

function RoundButton({ symbol, color, onPress, label, disabled }: { symbol: string; color: string; onPress: () => void; label: string; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.round, { backgroundColor: color }, disabled && { opacity: 0.35 }, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.roundText}>{symbol}</Text>
    </Pressable>
  );
}

/** Large on/off or pick-one choice. Selected state shown with a check mark and words, not color alone. */
export function Choice({ label, selected, onPress, detail }: { label: string; selected: boolean; onPress: () => void; detail?: string }) {
  const steady = useSteadyPress(onPress);
  return (
    <Pressable
      onPress={steady}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.checkBox, selected && { backgroundColor: colors.pine }]}>
        {selected && <Text style={styles.checkMark}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <T size="large" bold={selected}>
          {label}
        </T>
        {detail ? <T size="small" color={colors.muted}>{detail}</T> : null}
      </View>
    </Pressable>
  );
}

/** "Simulated band" label for every screen that uses the mock band. */
export function SimulatedBandTag() {
  return (
    <View style={styles.simTag} accessible accessibilityLabel="Simulated band. No real wristband is connected.">
      <T size="small" bold color={colors.white}>
        Simulated band
      </T>
    </View>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  hint,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  hint?: string;
  multiline?: boolean;
}) {
  const fontSize = useTextSize('large');
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <T size="large" bold>
        {label}
      </T>
      {hint ? <T size="small" color={colors.muted}>{hint}</T> : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        accessibilityLabel={label}
        style={[styles.input, { fontSize }, multiline && { minHeight: 140, textAlignVertical: 'top', paddingTop: spacing.sm }]}
      />
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }, style]}>{children}</View>;
}

export function Gap({ size = 'md' }: { size?: keyof typeof spacing }) {
  return <View style={{ height: spacing[size] }} />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: RADIUS, padding: spacing.lg, marginBottom: spacing.md },
  button: {
    borderRadius: RADIUS,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  buttonIcon: { width: 44, height: 44 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.sm },
  round: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  roundText: { color: colors.white, fontSize: 40, lineHeight: 44, fontFamily: fonts.bold },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: BUTTON_HEIGHT,
    padding: spacing.md,
    borderRadius: RADIUS,
    borderWidth: 2,
    borderColor: colors.muted,
    backgroundColor: colors.card,
    marginBottom: spacing.sm,
  },
  choiceSelected: { borderColor: colors.pine, borderWidth: 4, backgroundColor: colors.pineTint },
  checkBox: { width: 36, height: 36, borderRadius: 8, borderWidth: 3, borderColor: colors.pine, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: colors.white, fontSize: 24, fontFamily: fonts.bold, lineHeight: 28 },
  input: {
    minHeight: TOUCH_TARGET + 8,
    borderWidth: 2,
    borderColor: colors.text,
    borderRadius: RADIUS,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    color: colors.text,
    backgroundColor: colors.white,
  },
  simTag: { alignSelf: 'center', backgroundColor: colors.red, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginBottom: spacing.md },
});
