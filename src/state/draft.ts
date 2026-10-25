// The medication being added or edited, kept while moving through the add-medication screens.

import { create } from 'zustand';
import { ScheduleTime } from '../types';

type Draft = {
  id?: string; // set when editing an existing medication
  name: string;
  strength: string;
  notes: string;
  times: ScheduleTime[];
  fromScan: boolean;
  scanError?: string;
  labelDirections?: string;
  set(patch: Partial<Omit<Draft, 'set' | 'reset'>>): void;
  reset(): void;
};

const empty = { id: undefined, name: '', strength: '', notes: '', times: [], fromScan: false, scanError: undefined, labelDirections: undefined };

export const useDraft = create<Draft>()((set) => ({
  ...empty,
  set: (patch) => set(patch),
  reset: () => set(empty),
}));
