import React from 'react';
import { Image, ImageBackground, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, T } from '../components/ui';
import { ScreenProps } from '../navigation/types';
import { useApp } from '../state/store';
import { spacing } from '../theme/tokens';
import { MicButton } from '../voice/VoiceOverlay';

const sky = require('../assets/background.png');
const house = require('../assets/homepage_foreground.png');
const logo = require('../assets/parka_logo.png');

export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const insets = useSafeAreaInsets();
  const hasProfile = useApp((s) => !!s.profile && s.onboardingComplete);

  return (
    <ImageBackground source={sky} style={styles.root} resizeMode="cover">
      <View style={[styles.top, { paddingTop: insets.top + spacing.xl }]}>
        <Image source={logo} style={styles.logo} resizeMode="contain" accessible accessibilityLabel="PARKA" />
        <Card style={{ marginTop: spacing.lg }}>
          <T size="large" bold center>
            A wearable that protects you from the harsh cold of Parkinson’s
          </T>
        </Card>
        <Button label="Get Started" onPress={() => navigation.navigate('Onboarding', { step: 1 })} />
        {hasProfile && <Button label="Log Back In" variant="red" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })} />}
      </View>
      <Image source={house} style={styles.house} resizeMode="contain" accessibilityIgnoresInvertColors />
      <View style={[styles.mic, { bottom: insets.bottom }]}>
        <MicButton />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { paddingHorizontal: spacing.lg, zIndex: 1 },
  logo: { width: '90%', height: 110, alignSelf: 'center' },
  house: { position: 'absolute', bottom: 0, width: '100%', height: '38%' },
  mic: { position: 'absolute', left: spacing.md },
});
