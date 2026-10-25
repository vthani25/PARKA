import { useNavigation } from '@react-navigation/native';
import React, { ReactNode } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { goTo } from '../navigation/types';
import { useApp } from '../state/store';
import { colors, spacing, TOUCH_TARGET } from '../theme/tokens';
import { MicButton } from '../voice/VoiceOverlay';
import { SimulatedBandTag, T, useSteadyPress } from './ui';

const sky = require('../assets/background.png');
const logo = require('../assets/parka_logo.png');

type Props = {
  children: ReactNode;
  showMenu?: boolean;
  showBack?: boolean;
  simulatedBand?: boolean;
  scroll?: boolean;
  /** Fixed area at the bottom, right of the mic button (for a main action like "Next"). */
  footer?: ReactNode;
  headerTitle?: string;
};

/** Every screen: sky background, header with logo and menu, mic button bottom left. */
export function Screen({ children, showMenu = true, showBack = true, simulatedBand, scroll = true, footer, headerTitle }: Props) {
  const insets = useSafeAreaInsets();
  const highContrast = useApp((s) => s.settings.highContrast);
  const voiceEnabled = useApp((s) => s.settings.voiceEnabled);
  const navigation = useNavigation();
  const canGoBack = showBack && navigation.canGoBack();
  const back = useSteadyPress(() => navigation.goBack());
  const openMenu = useSteadyPress(() => goTo('Menu'));

  const body = (
    <>
      {simulatedBand && <SimulatedBandTag />}
      {children}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: highContrast ? colors.white : colors.background }]}>
      {!highContrast && <ImageBackground source={sky} style={StyleSheet.absoluteFill} resizeMode="cover" />}

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }, highContrast && styles.headerContrast]}>
        <View style={styles.side}>
          {canGoBack && (
            <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={styles.headerButton}>
              <T size="large" bold color={colors.pine}>
                ‹ Back
              </T>
            </Pressable>
          )}
        </View>
        <View style={styles.center} accessible accessibilityRole="header" accessibilityLabel={headerTitle ? `PARKA ${headerTitle}` : 'PARKA'}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          {headerTitle ? (
            <T size="small" bold>
              {headerTitle}
            </T>
          ) : null}
        </View>
        <View style={[styles.side, { alignItems: 'flex-end' }]}>
          {showMenu && (
            <Pressable onPress={openMenu} accessibilityRole="button" accessibilityLabel="Open menu" style={styles.headerButton}>
              <View style={styles.burger} />
              <View style={styles.burger} />
              <View style={styles.burger} />
            </Pressable>
          )}
        </View>
      </View>

      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 140 + insets.bottom }]} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1, paddingBottom: 120 + insets.bottom }]}>{body}</View>
      )}

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]} pointerEvents="box-none">
        {voiceEnabled ? <MicButton /> : <View style={{ width: TOUCH_TARGET + 8 }} />}
        <View style={{ flex: 1 }}>{footer}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerContrast: { borderBottomWidth: 3, borderBottomColor: colors.black },
  side: { width: 110 },
  center: { flex: 1, alignItems: 'center' },
  logo: { width: 130, height: 42 },
  headerButton: { minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm, gap: 6 },
  burger: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.text },
  content: { padding: spacing.md },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
});
