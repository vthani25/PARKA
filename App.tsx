import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold, useFonts } from '@expo-google-fonts/atkinson-hyperlegible';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { band, startBand, todaysBandTimes } from './src/band';
import { goTo, navigationRef, RootStackParamList } from './src/navigation/types';
import { CheckInHomeScreen, CheckInItemScreen, CheckInNotesScreen, CheckInOverallScreen, CheckInSummaryScreen, ChooseTrackablesScreen, OffHoursScreen } from './src/screens/checkin/CheckInScreens';
import { ReportsScreen } from './src/screens/checkin/ReportsScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { HospitalCardEditScreen, HospitalCardScreen } from './src/screens/HospitalCardScreens';
import { AddMedConfirmScreen, AddMedDoneScreen, AddMedStartScreen, AddMedSummaryScreen, AddMedTimesScreen, AddMedTypeScreen } from './src/screens/meds/AddMedScreens';
import { DeleteMedScreen, EditMedsScreen, ManageMedsScreen, MedDetailScreen } from './src/screens/meds/MedsScreens';
import { MenuScreen } from './src/screens/MenuScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { BandDebugScreen, RecipientsScreen, SettingsScreen } from './src/screens/SettingsScreens';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { handleNotificationAction, registerNotificationTask } from './src/services/backgroundTask';
import { scheduleDoseNotifications, scheduleWakeNotification, setupNotifications } from './src/services/notifications';
import { loadStore, useApp } from './src/state/store';
import { colors } from './src/theme/tokens';
import { VoiceProvider } from './src/voice/VoiceOverlay';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Notification taps: an action button runs it; tapping the body opens the dashboard. */
function onNotificationResponse(response: Notifications.NotificationResponse) {
  if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    if (useApp.getState().onboardingComplete) goTo('Dashboard');
  } else {
    handleNotificationAction(response);
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await loadStore();
      useApp.getState().ensureToday();
      startBand();
      await setupNotifications().catch(() => {});
      await registerNotificationTask();
      if (useApp.getState().onboardingComplete) {
        await scheduleWakeNotification().catch(() => {});
        await scheduleDoseNotifications().catch(() => {});
      }
      // Today's reminder times wait for the band and are sent when it connects.
      band.setReminders(todaysBandTimes());
      band.setMetronomeTempo(useApp.getState().settings.metronomeTempo);
      setReady(true);
    })();
    const sub = Notifications.addNotificationResponseReceivedListener(onNotificationResponse);
    return () => sub.remove();
  }, []);

  const onNavigationReady = () => {
    // Opened by tapping a notification while the app was closed.
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      onNotificationResponse(last);
      Notifications.clearLastNotificationResponse();
    }
    SplashScreen.hideAsync().catch(() => {});
  };

  if (!fontsLoaded || !ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer ref={navigationRef} onReady={onNavigationReady}>
        <VoiceProvider>
          <Stack.Navigator
            initialRouteName="Welcome"
            screenOptions={{ headerShown: false, gestureEnabled: false, animation: 'fade', contentStyle: { backgroundColor: colors.background } }}
          >
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Menu" component={MenuScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="ManageMeds" component={ManageMedsScreen} />
            <Stack.Screen name="EditMeds" component={EditMedsScreen} />
            <Stack.Screen name="MedDetail" component={MedDetailScreen} />
            <Stack.Screen name="DeleteMed" component={DeleteMedScreen} />
            <Stack.Screen name="AddMedStart" component={AddMedStartScreen} />
            <Stack.Screen name="AddMedConfirm" component={AddMedConfirmScreen} />
            <Stack.Screen name="AddMedType" component={AddMedTypeScreen} />
            <Stack.Screen name="AddMedTimes" component={AddMedTimesScreen} />
            <Stack.Screen name="AddMedSummary" component={AddMedSummaryScreen} />
            <Stack.Screen name="AddMedDone" component={AddMedDoneScreen} />
            <Stack.Screen name="CheckInHome" component={CheckInHomeScreen} />
            <Stack.Screen name="ChooseTrackables" component={ChooseTrackablesScreen} />
            <Stack.Screen name="CheckInItem" component={CheckInItemScreen} />
            <Stack.Screen name="OffHours" component={OffHoursScreen} />
            <Stack.Screen name="CheckInNotes" component={CheckInNotesScreen} />
            <Stack.Screen name="CheckInOverall" component={CheckInOverallScreen} />
            <Stack.Screen name="CheckInSummary" component={CheckInSummaryScreen} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="HospitalCard" component={HospitalCardScreen} />
            <Stack.Screen name="HospitalCardEdit" component={HospitalCardEditScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Recipients" component={RecipientsScreen} />
            <Stack.Screen name="BandDebug" component={BandDebugScreen} />
          </Stack.Navigator>
        </VoiceProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
