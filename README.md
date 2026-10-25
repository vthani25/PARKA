# PARKA

A wristband and companion Android app for people with Parkinson's disease. Built for the Congressional App Challenge.

The wristband has one big button. A long press starts a haptic metronome that paces steps during freezing of gait. At dose time it vibrates; a short press logs the dose, timestamped by its RTC clock, saved to flash and synced to the app over Bluetooth.

The app:

- **Dashboard**: next dose, doses taken today, metronome use, band status.
- **Medications**: scan a pill bottle (on-device text recognition) or type it, confirm, set times and doses.
- **"I'm awake"**: one tap on the morning notification moves today's reminders to fit when you woke up and updates the band.
- **Daily check-in**: pick 5 to 10 things to track, rate them with smileys, mark when you felt off, add typed or spoken notes. Daily and weekly reports can be texted to a caregiver or shared as a PDF.
- **Hospital card**: based on the Parkinson's Foundation Medical Alert Card, with your live medication schedule, last dose and next dose, shareable as a PDF.
- **Voice**: say "open medications", "log a dose", "I'm awake" and more. Unclear speech is never guessed.
- Made for tremor: large text (Atkinson Hyperlegible), high contrast, big buttons, no swipes or drags.

> This version uses a **simulated band**. It speaks the same byte protocol as the real wristband, but nothing goes over Bluetooth yet. Screens that use it say "Simulated band".

All data stays on the phone. No accounts, no cloud, no analytics. PARKA never gives medical advice or suggests changing a dose.

## Run it

Requirements: Node 20+, JDK 17, Android Studio with an emulator or a phone with USB debugging.

```bash
npm install
npx expo run:android
```

This builds a development build (not Expo Go) and starts Metro. After the first build, `npm start` is enough.

**Windows:** the native build fails with "Filename longer than 260 characters" if the project sits in a deep folder (for example inside OneDrive). Clone it to a short path such as `C:\dev\parka`, or turn on Windows long path support.

Tests:

```bash
npm test
```

## Code tour

| Path | What it does |
| --- | --- |
| `src/logic/reminders.ts` | `recalculateReminders`: moves today's doses to the wake time, keeping the gaps between them |
| `src/voice/matchCommand.ts` | `matchCommand`: maps what was said to one action from a fixed list, or refuses |
| `src/band/protocol.ts` | Byte format for messages between the app and the band |
| `src/band/sync.ts` | What happens when the band connects: clock check, stored events, pending updates |
| `src/band/MockBandService.ts` | Simulated band and its debug panel actions |
| `src/ocr/scanLabel.ts`, `parseLabel.ts` | On-device OCR and pulling the medication name and strength from the label |
| `src/logic/checkin.ts` | Check-in scoring |
| `src/logic/reports.ts` | Daily, weekly and hospital card reports |

Debug panel for the simulated band: Settings, then long-press the version number.

