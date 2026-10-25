// Read a pill bottle label from a photo, on the phone (Google ML Kit text recognition).
// No cloud service and no API key. To use a cloud OCR later, only this function changes.

import { extractTextFromImage, isSupported } from 'expo-text-extractor';
import { LabelResult, parseLabel } from './parseLabel';

export type ScanResult = { ok: true; label: LabelResult } | { ok: false; reason: string };

export async function scanLabel(photoUri: string): Promise<ScanResult> {
  if (!isSupported) return { ok: false, reason: 'Text reading is not available on this phone.' };
  try {
    const lines = await extractTextFromImage(photoUri);
    if (lines.length === 0) return { ok: false, reason: 'No text was found in the photo.' };
    const label = parseLabel(lines);
    if (!label.name) return { ok: false, reason: "PARKA couldn't find a medication name on the label." };
    return { ok: true, label };
  } catch {
    return { ok: false, reason: "PARKA couldn't read the photo." };
  }
}
