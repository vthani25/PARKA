// Daily and weekly reports: plain text (for a text message) and HTML (for the PDF).
// Facts only. No advice or interpretation.

import { CheckIn, DayState, DoseLog, HospitalCard, Medication, Schedule, Trackable } from '../types';
import { isRated, MEDS_ON_TIME_ID, offHoursByTimeOfDay, SCORE_WORDS } from './checkin';
import { findLog } from './reminders';
import { addDays, atTime, formatDay, formatDose, formatHour, formatTime, timeOf } from './time';

export type ReportData = {
  name?: string;
  medications: Medication[];
  schedules: Schedule[];
  doseLogs: DoseLog[];
  day: DayState;
  trackables: Trackable[];
  customTrackables: Trackable[];
  checkIns: CheckIn[];
};

const medName = (d: ReportData, id: string) => d.medications.find((m) => m.id === id)?.name ?? 'Medication';
const trackableLabel = (d: ReportData, id: string) =>
  [...d.trackables, ...d.customTrackables].find((t) => t.id === id)?.label ?? (id === MEDS_ON_TIME_ID ? 'Medications on time' : id);

function entryText(d: ReportData, e: CheckIn['entries'][number]) {
  const t = [...d.trackables, ...d.customTrackables].find((x) => x.id === e.trackableId);
  const amount = e.value !== undefined && t?.unit ? ` (${e.value} of ${t.goal} ${t.unit})` : '';
  return `${trackableLabel(d, e.trackableId)}: ${e.score}/5 ${SCORE_WORDS[e.score]}${amount}`;
}

/** Medication rows for one day: time, medication, dose, taken at. */
function medicationRows(d: ReportData, date: string) {
  const reminders = d.day.date === date ? d.day.reminders : [];
  return reminders.map((r) => {
    const log = findLog(d.doseLogs, date, r);
    return {
      time: formatTime(r.time),
      medication: medName(d, r.medicationId),
      dose: formatDose(r.dose),
      takenAt: log ? `${formatTime(timeOf(new Date(log.loggedAt)))}${log.source === 'band' ? ' (band)' : ''}` : 'Not logged',
    };
  });
}

export function dailyReportText(d: ReportData, date: string): string {
  const c = d.checkIns.find((x) => x.date === date);
  const lines = [`PARKA daily report${d.name ? ` for ${d.name}` : ''}`, formatDay(date), ''];
  if (c) {
    lines.push(isRated(c) ? `Day score: ${c.dayScore} out of 100` : 'Trackables not rated yet');
    if (c.overall) lines.push(`Overall: ${c.overall}/5 ${SCORE_WORDS[c.overall]}`);
    lines.push('', ...c.entries.map((e) => entryText(d, e)));
    lines.push('', `Felt off: ${c.offHours.length ? c.offHours.map(formatHour).join(', ') : 'None'}`);
    if (c.note) lines.push('', `Notes: ${c.note}`);
  } else {
    lines.push('No check-in saved for this day.');
  }
  const meds = medicationRows(d, date);
  if (meds.length) lines.push('', 'Medications:', ...meds.map((m) => `${m.time} ${m.medication} ${m.dose}: ${m.takenAt}`));
  return lines.join('\n');
}

export function weekDates(endDate: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(endDate, i - 6));
}

function weekSummary(d: ReportData, endDate: string) {
  const dates = weekDates(endDate);
  const week = d.checkIns.filter((c) => dates.includes(c.date));
  const ids = [...new Set(week.flatMap((c) => c.entries.map((e) => e.trackableId)))];
  const averages = ids.map((id) => {
    const scores = week.flatMap((c) => c.entries.filter((e) => e.trackableId === id).map((e) => e.score));
    return { label: trackableLabel(d, id), avg: scores.reduce((s, v) => s + v, 0) / scores.length };
  });
  const due = d.doseLogs.filter((l) => dates.includes(l.date));
  const onTime = due.filter((l) => Math.abs(l.loggedAt - atTime(l.date, l.scheduledTime).getTime()) <= 15 * 60000).length;
  return {
    dates,
    scores: dates.map((date) => {
      const c = week.find((x) => x.date === date);
      return { date, score: isRated(c) ? c.dayScore : undefined };
    }),
    averages,
    onTimePct: due.length ? Math.round((onTime / due.length) * 100) : undefined,
    offHours: offHoursByTimeOfDay(week),
    notes: week.filter((c) => c.note).map((c) => ({ date: c.date, note: c.note! })),
  };
}

const shortDay = (date: string) => atTime(date, '12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

export function weeklyReportText(d: ReportData, endDate: string): string {
  const w = weekSummary(d, endDate);
  const lines = [`PARKA weekly report${d.name ? ` for ${d.name}` : ''}`, `${formatDay(w.dates[0])} to ${formatDay(endDate)}`, '', 'Day scores:'];
  lines.push(...w.scores.map((s) => `${shortDay(s.date)}: ${s.score ?? 'no check-in'}`));
  lines.push('', 'Average per trackable:', ...w.averages.map((a) => `${a.label}: ${a.avg.toFixed(1)}/5`));
  lines.push('', `Medications logged on time (within 15 min): ${w.onTimePct === undefined ? 'no doses logged' : `${w.onTimePct}%`}`);
  lines.push('', 'Times felt off:', ...w.offHours.map((o) => `${o.label}: ${o.count}`));
  if (w.notes.length) lines.push('', 'Notes:', ...w.notes.map((n) => `${shortDay(n.date)}: ${n.note}`));
  return lines.join('\n');
}

// ---- HTML for PDFs ----

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PAGE_STYLE = `
  <style>
    @page { margin: 18mm; }
    body { font-family: 'Atkinson Hyperlegible', Arial, sans-serif; color: #242422; font-size: 13pt; }
    h1 { color: #375a41; font-size: 22pt; margin: 0 0 4px; }
    h2 { color: #375a41; font-size: 15pt; margin: 18px 0 6px; border-bottom: 2px solid #375a41; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #242422; padding: 5px 8px; text-align: left; vertical-align: top; }
    th { background: #E3EBE6; }
    .muted { color: #4A4A46; font-size: 11pt; }
    .bar { background: #375a41; height: 18px; display: inline-block; vertical-align: middle; }
    .alert { border: 3px solid #9b2425; padding: 10px; margin-bottom: 10px; }
    .alert b { color: #9b2425; }
  </style>`;

export function dailyReportHtml(d: ReportData, date: string): string {
  const c = d.checkIns.find((x) => x.date === date);
  const meds = medicationRows(d, date);
  return `<html><head><meta charset="utf-8">${PAGE_STYLE}</head><body>
    <h1>PARKA daily report</h1>
    <div>${esc(d.name ?? '')} · ${esc(formatDay(date))}</div>
    ${
      c
        ? `<h2>${isRated(c) ? `Day score: ${c.dayScore} out of 100` : 'Trackables not rated yet'}</h2>
      ${c.overall ? `<p>Overall: ${c.overall}/5 ${SCORE_WORDS[c.overall]}</p>` : ''}
      <table><tr><th>Trackable</th><th>Score</th></tr>
      ${c.entries.map((e) => `<tr><td>${esc(entryText(d, e).split(':')[0])}</td><td>${esc(entryText(d, e).split(': ').slice(1).join(': '))}</td></tr>`).join('')}
      </table>
      <h2>Felt off</h2><p>${c.offHours.length ? c.offHours.map(formatHour).join(', ') : 'None'}</p>
      ${c.note ? `<h2>Notes</h2><p>${esc(c.note)}</p>` : ''}`
        : '<p>No check-in saved for this day.</p>'
    }
    <h2>Medications</h2>
    ${meds.length ? `<table><tr><th>Time</th><th>Medication</th><th>Dose</th><th>Taken at</th></tr>${meds.map((m) => `<tr><td>${m.time}</td><td>${esc(m.medication)}</td><td>${m.dose}</td><td>${m.takenAt}</td></tr>`).join('')}</table>` : '<p>No medications scheduled.</p>'}
    <p class="muted">Created by the PARKA app from information entered by the patient.</p>
  </body></html>`;
}

export function weeklyReportHtml(d: ReportData, endDate: string): string {
  const w = weekSummary(d, endDate);
  return `<html><head><meta charset="utf-8">${PAGE_STYLE}</head><body>
    <h1>PARKA weekly report</h1>
    <div>${esc(d.name ?? '')} · ${esc(formatDay(w.dates[0]))} to ${esc(formatDay(endDate))}</div>
    <h2>Day scores (out of 100)</h2>
    <table>${w.scores
      .map((s) => `<tr><td style="width:110px">${shortDay(s.date)}</td><td>${s.score === undefined ? 'No check-in' : `<span class="bar" style="width:${s.score * 3}px"></span> ${s.score}`}</td></tr>`)
      .join('')}</table>
    <h2>Average per trackable</h2>
    <table><tr><th>Trackable</th><th>Average (1 to 5)</th></tr>${w.averages.map((a) => `<tr><td>${esc(a.label)}</td><td>${a.avg.toFixed(1)}</td></tr>`).join('')}</table>
    <h2>Medications on time</h2>
    <p>${w.onTimePct === undefined ? 'No doses logged this week.' : `${w.onTimePct}% of logged doses within 15 minutes of the scheduled time.`}</p>
    <h2>Times felt off</h2>
    <table>${w.offHours.map((o) => `<tr><td>${o.label}</td><td>${o.count}</td></tr>`).join('')}</table>
    ${w.notes.length ? `<h2>Notes</h2>${w.notes.map((n) => `<p><b>${shortDay(n.date)}:</b> ${esc(n.note)}</p>`).join('')}` : ''}
    <p class="muted">Created by the PARKA app from information entered by the patient.</p>
  </body></html>`;
}

// ---- Hospital card ----

export const HOSPITAL_ALERT =
  'I have PARKINSON’S DISEASE which could make me unsteady, move slowly and have difficulty speaking. I AM NOT INTOXICATED. Please call my family or doctor for help.';

export const HOSPITAL_POINTS = [
  'I have Parkinson’s disease.',
  'I need my medications on time, every time (within 15 minutes of my home schedule), or my symptoms may become severe and uncontrollable.',
  'Any Parkinson’s medication changes need to be discussed with my doctor.',
  'Many common medications for pain, nausea, depression, sleep and psychosis are not safe for people with PD. For the current lists, see Parkinson.org/HospitalSafety or call 1-800-4PD-INFO.',
];

export const DEVICE_NOTE =
  'Device note: review imaging requirements before any scan, use patient-supplied medication if the hospital does not have it, and contact the patient’s Parkinson’s doctor or the device maker.';

export const FLAG_LABELS: Record<keyof HospitalCard['flags'], string> = {
  swallowing: 'Trouble swallowing',
  balance: 'Balance problems',
  dbs: 'Deep brain stimulation (DBS) device',
  deliveryDevice: 'Medication delivery device',
  dizzy: 'Dizzy or faint',
  confusion: 'Confusion',
  hallucinations: 'Hallucinations',
  dementia: 'Dementia',
  dietary: 'Special dietary needs',
};

export type HospitalMedRow = { time: string; medication: string; dose: string; notes: string };

export function hospitalMedRows(d: ReportData): HospitalMedRow[] {
  return d.schedules
    .flatMap((s) =>
      s.times.map((t) => {
        const m = d.medications.find((x) => x.id === s.medicationId);
        return { sort: t.time, time: formatTime(t.time), medication: `${m?.name ?? 'Medication'}${m?.strength ? ` ${m.strength}` : ''}`, dose: formatDose(t.dose), notes: m?.notes ?? '' };
      }),
    )
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .map(({ sort: _sort, ...row }) => row);
}

export function hospitalCardHtml(card: HospitalCard, rows: HospitalMedRow[], lastDose: string, nextDue: string): string {
  const flags = (Object.keys(FLAG_LABELS) as (keyof HospitalCard['flags'])[]).filter((k) => card.flags[k]);
  const field = (label: string, value?: string) => (value ? `<tr><th style="width:38%">${label}</th><td>${esc(value)}</td></tr>` : '');
  return `<html><head><meta charset="utf-8">${PAGE_STYLE}<style>body{font-size:11pt} h2{margin-top:10px}</style></head><body>
    <h1>Medical Alert: Parkinson’s Disease</h1>
    <div class="alert"><b>${esc(HOSPITAL_ALERT)}</b></div>
    <ul>${HOSPITAL_POINTS.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    <table>
      ${field('Name', card.patientName)}
      ${field('Year diagnosed', card.diagnosedYear)}
      ${field('Home address', card.homeAddress)}
      ${field('Emergency contact', [card.careContact.name, card.careContact.phone].filter(Boolean).join(', '))}
      ${field('Parkinson’s doctor', [card.parkinsonsDoctor.name, card.parkinsonsDoctor.phone].filter(Boolean).join(', '))}
      ${field('Primary doctor', card.primaryDoctor)}
      ${field('Pharmacy', card.pharmacy)}
      ${field('Allergies', card.allergies || 'None listed')}
      ${field('Other conditions', card.otherConditions)}
      ${field('Please note', flags.map((f) => FLAG_LABELS[f]).join(', '))}
    </table>
    ${card.flags.dbs || card.flags.deliveryDevice ? `<p class="alert">${esc(DEVICE_NOTE)}</p>` : ''}
    <h2>Medications (home schedule)</h2>
    <table><tr><th>Time</th><th>Medication</th><th>Dose</th><th>Notes</th></tr>
    ${rows.map((r) => `<tr><td>${r.time}</td><td>${esc(r.medication)}</td><td>${r.dose}</td><td>${esc(r.notes)}</td></tr>`).join('') || '<tr><td colspan="4">No medications entered</td></tr>'}
    </table>
    <p><b>Last dose logged:</b> ${esc(lastDose)} &nbsp; · &nbsp; <b>Next due:</b> ${esc(nextDue)}</p>
    <p class="muted">Patient-provided information. Hospital to verify medications with the prescriber and pharmacist.<br>
    Based on the Parkinson’s Foundation Medical Alert Card.</p>
  </body></html>`;
}
