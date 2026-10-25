// Voice commands: turn what the person said into one action from a fixed list.
// Never guess: if nothing matches well enough, or two actions match about equally, return null
// and the app says "I didn't catch that. Please say it again."

export type VoiceAction =
  | 'go_home'
  | 'open_medications'
  | 'add_medication'
  | 'open_checkin'
  | 'show_hospital_card'
  | 'open_settings'
  | 'im_awake'
  | 'log_dose';

type Command = {
  action: VoiceAction;
  label: string; // read back to the person
  changesData: boolean; // if true, ask "Is that right?" before doing it
  phrases: string[];
};

export const COMMANDS: Command[] = [
  { action: 'go_home', label: 'Go home', changesData: false, phrases: ['go home', 'home', 'home screen', 'dashboard', 'main screen'] },
  { action: 'open_medications', label: 'Open medications', changesData: false, phrases: ['open medications', 'medications', 'medicine', 'manage meds', 'my pills'] },
  { action: 'add_medication', label: 'Add a medication', changesData: false, phrases: ['add a medication', 'add medication', 'new medication', 'new pill', 'add pill', 'scan pills', 'scan pill bottle'] },
  { action: 'open_checkin', label: 'Open check-in', changesData: false, phrases: ['open check in', 'check in', 'daily check in', 'scoreboard'] },
  { action: 'show_hospital_card', label: 'Show hospital card', changesData: false, phrases: ['show hospital card', 'hospital card', 'hospital', 'medical alert card', 'alert card'] },
  { action: 'open_settings', label: 'Open settings', changesData: false, phrases: ['open settings', 'settings'] },
  { action: 'im_awake', label: "I'm awake", changesData: true, phrases: ['i am awake', 'awake', 'i just woke up', 'good morning'] },
  { action: 'log_dose', label: 'Log a dose', changesData: true, phrases: ['log a dose', 'log dose', 'log my dose', 'i took my medicine', 'i took my pills', 'dose taken', 'took my dose'] },
];

/** Below this score we refuse instead of guessing. */
export const CONFIDENCE_THRESHOLD = 0.8;
/** If the second-best action is this close to the best, it's ambiguous: refuse. */
export const AMBIGUITY_MARGIN = 0.1;

// Small words that don't change the meaning ("please open my settings" = "settings").
const FILLER = new Set([
  'a', 'an', 'the', 'my', 'me', 'to', 'please', 'can', 'could', 'would', 'you', 'i', 'im', 'am', 'want',
  'like', 'go', 'open', 'show', 'take', 'now', 'hey', 'parka', 'um', 'uh', 'just', 'up', 'of',
]);

export type Match = { action: VoiceAction; label: string; changesData: boolean; confidence: number };

/**
 * Match a transcript to a command.
 * Each phrase gets a score from 0 to 1: how well its words cover what was said, and how much of
 * what was said they explain. Small spelling differences ("medication" vs "medications") still count.
 */
export function matchCommand(transcript: string): Match | null {
  const said = meaningfulWords(transcript);
  if (said.length === 0) return null;

  // Best score for each action.
  const scored = COMMANDS.map((command) => ({
    command,
    score: Math.max(...command.phrases.map((p) => phraseScore(meaningfulWords(p), said))),
  })).sort((a, b) => b.score - a.score);

  const [best, second] = scored;
  if (best.score < CONFIDENCE_THRESHOLD) return null; // not sure enough
  if (second && best.score - second.score < AMBIGUITY_MARGIN) return null; // two actions fit

  const { action, label, changesData } = best.command;
  return { action, label, changesData, confidence: best.score };
}

/** Lowercase words with punctuation removed and filler words dropped. "Check-in" -> ["check", "in"]. */
export function meaningfulWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 0 && !FILLER.has(w));
}

/** F-score: how many phrase words were said (recall) and how many said words belong to the phrase (precision). */
function phraseScore(phrase: string[], said: string[]): number {
  if (phrase.length === 0) return 0;
  const recall = average(phrase.map((p) => bestSimilarity(p, said)));
  const precision = average(said.map((s) => bestSimilarity(s, phrase)));
  if (recall + precision === 0) return 0;
  return (2 * recall * precision) / (recall + precision);
}

function bestSimilarity(word: string, words: string[]): number {
  const best = Math.max(0, ...words.map((w) => similarity(word, w)));
  return best >= 0.75 ? best : 0; // a weak partial match counts as no match
}

/** 1 = same word, 0 = nothing in common (based on edit distance). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length];
}

function average(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}
