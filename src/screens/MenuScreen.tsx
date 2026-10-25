import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Card, Divider, T, useSteadyPress } from '../components/ui';
import { goTo, RootStackParamList, ScreenProps } from '../navigation/types';
import { spacing } from '../theme/tokens';

const ITEMS: { label: string; icon: ImageSourcePropType; route: keyof RootStackParamList }[] = [
  { label: 'Return Home', icon: require('../assets/sidebar1_icon.png'), route: 'Dashboard' },
  { label: 'Manage Meds', icon: require('../assets/sidebar2_icon.png'), route: 'ManageMeds' },
  { label: 'Hospital Card', icon: require('../assets/sidebar3_icon.png'), route: 'HospitalCard' },
  { label: 'Daily Check-In', icon: require('../assets/sidebar4_icon.png'), route: 'CheckInHome' },
  { label: 'Settings', icon: require('../assets/sidebar5_icon.png'), route: 'Settings' },
];

export function MenuScreen({ navigation }: ScreenProps<'Menu'>) {
  return (
    <Screen showMenu={false}>
      <Card style={styles.panel}>
        {ITEMS.map((item, i) => (
          <View key={item.route}>
            <MenuRow
              {...item}
              onPress={() => {
                if (item.route === 'Dashboard') goTo('Dashboard');
                else navigation.replace(item.route as 'ManageMeds');
              }}
            />
            {i < ITEMS.length - 1 && <Divider thick />}
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function MenuRow({ label, icon, onPress }: { label: string; icon: ImageSourcePropType; onPress: () => void }) {
  const steady = useSteadyPress(onPress);
  return (
    <Pressable onPress={steady} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <View style={styles.iconBox}>
        <Image source={icon} style={styles.icon} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
      <T size="heading" bold style={{ flex: 1 }}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { paddingVertical: 0, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 104 },
  iconBox: { width: 80, alignItems: 'center' },
  icon: { width: 72, height: 64 },
});
