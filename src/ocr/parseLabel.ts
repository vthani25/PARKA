// Our parsing code: pull the medication name, strength and directions out of the text
// that on-device OCR recognized on a pill bottle label. Nothing is saved until the person confirms.

import { similarity } from '../voice/matchCommand';

export type LabelResult = { name?: string; strength?: string; directions?: string; rawText: string };

// Parkinson's medications, generic and brand names, as they should be displayed.
const KNOWN_MEDICATIONS = [
  'Carbidopa', 'Levodopa', 'Sinemet', 'Rytary', 'Dhivy', 'Duopa', 'Vyalev', 'Inbrija', 'Stalevo',
  'Entacapone', 'Comtan', 'Tolcapone', 'Tasmar', 'Opicapone', 'Ongentys',
  'Pramipexole', 'Mirapex', 'Ropinirole', 'Requip', 'Rotigotine', 'Neupro', 'Apomorphine', 'Apokyn', 'Kynmobi', 'Onapgo',
  'Rasagiline', 'Azilect', 'Selegiline', 'Eldepryl', 'Zelapar', 'Safinamide', 'Xadago',
  'Amantadine', 'Gocovri', 'Osmolex', 'Istradefylline', 'Nourianz',
  'Trihexyphenidyl', 'Benztropine', 'Cogentin', 'Pimavanserin', 'Nuplazid',
  'Rivastigmine', 'Exelon', 'Donepezil', 'Aricept', 'Droxidopa', 'Northera', 'Midodrine',
];

// 25 mg, 25/100 MG, 0.5mg, 1.5 MG, 100 mcg
const STRENGTH = /(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)\s*(mg|mcg|ug|µg|ml)\b/i;
const DIRECTIONS = /\b(take|by mouth|daily|times a day|every|tablet|capsule)s?\b/i;

export function parseLabel(lines: string[]): LabelResult {
  const rawText = lines.join('\n');
  const words = rawText.split(/[^A-Za-z]+/).filter((w) => w.length >= 5);

  // 1. Name: known medication names, allowing small OCR mistakes ("Levodapa").
  const found: string[] = [];
  for (const word of words) {
    const match = closestKnown(word);
    if (match && !found.includes(match)) found.push(match);
  }
  let name: string | undefined;
  if (found.includes('Carbidopa') && found.includes('Levodopa')) name = 'Carbidopa/Levodopa';
  else name = found[0];

  // 2. Strength: first "number + unit" on the label.
  const strengthMatch = rawText.match(STRENGTH);
  const strength = strengthMatch ? `${strengthMatch[1].replace(/\s+/g, '')} ${strengthMatch[2].toLowerCase()}` : undefined;

  // 3. Directions: the first line that reads like instructions. Shown to the person, never used to set doses.
  const directions = lines.find((l) => DIRECTIONS.test(l) && l.trim().length > 8)?.trim();

  return { name, strength, directions, rawText };
}

function closestKnown(word: string): string | undefined {
  let best: string | undefined;
  let bestScore = 0;
  for (const known of KNOWN_MEDICATIONS) {
    const score = similarity(word.toLowerCase(), known.toLowerCase());
    if (score > bestScore) {
      best = known;
      bestScore = score;
    }
  }
  return bestScore >= 0.8 ? best : undefined;
}
