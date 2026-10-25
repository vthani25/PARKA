import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import { ReportData } from '../logic/reports';
import { useApp } from '../state/store';

/** Make a PDF on the phone and open the Android share sheet. */
export async function sharePdf(html: string, title: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 }); // US Letter
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title, UTI: 'com.adobe.pdf' });
}

/**
 * Open the messaging app addressed to the recipient with the report filled in.
 * The person taps send themselves; the app never sends anything on its own.
 */
export async function openTextMessage(phone: string, body: string): Promise<void> {
  const number = phone.replace(/[^\d+]/g, '');
  await Linking.openURL(`sms:${number}?body=${encodeURIComponent(body)}`);
}

export function reportData(): ReportData {
  const s = useApp.getState();
  return {
    name: s.profile?.name,
    medications: s.medications,
    schedules: s.schedules,
    doseLogs: s.doseLogs,
    day: s.day,
    trackables: s.trackables,
    customTrackables: s.customTrackables,
    checkIns: s.checkIns,
  };
}
