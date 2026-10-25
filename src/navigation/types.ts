import { createNavigationContainerRef } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Welcome: undefined;
  Onboarding: { step: number };
  Dashboard: undefined;
  Menu: undefined;
  ManageMeds: undefined;
  EditMeds: undefined;
  MedDetail: { id: string };
  DeleteMed: { id: string };
  AddMedStart: undefined;
  AddMedConfirm: undefined;
  AddMedType: undefined;
  AddMedTimes: undefined;
  AddMedSummary: undefined;
  AddMedDone: undefined;
  CheckInHome: undefined;
  ChooseTrackables: { thenStart?: boolean } | undefined;
  CheckInItem: { index: number };
  OffHours: undefined;
  CheckInNotes: undefined;
  CheckInOverall: undefined;
  CheckInSummary: undefined;
  Reports: undefined;
  HospitalCard: undefined;
  HospitalCardEdit: undefined;
  Settings: undefined;
  Recipients: undefined;
  BandDebug: undefined;
};

export type ScreenProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Navigate from outside a screen (voice commands, notifications). */
export function goTo<K extends keyof RootStackParamList>(...args: undefined extends RootStackParamList[K] ? [K] | [K, RootStackParamList[K]] : [K, RootStackParamList[K]]) {
  if (!navigationRef.isReady()) return;
  const [name, params] = args;
  if (name === 'Dashboard') {
    navigationRef.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    return;
  }
  // @ts-expect-error -- params type depends on the route name
  navigationRef.navigate(name, params);
}
