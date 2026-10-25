// Today's check-in while it is being filled in, one screen at a time.

import { create } from 'zustand';
import { CheckInEntry } from '../types';

type CheckInDraft = {
  entries: Record<string, CheckInEntry>; // by trackable id; skipped items are absent
  offHours: number[];
  note: string;
  overall?: number;
  setEntry(entry: CheckInEntry): void;
  skip(trackableId: string): void;
  set(patch: Partial<Pick<CheckInDraft, 'offHours' | 'note' | 'overall'>>): void;
  reset(): void;
};

export const useCheckInDraft = create<CheckInDraft>()((set) => ({
  entries: {},
  offHours: [],
  note: '',
  overall: undefined,
  setEntry: (entry) => set((s) => ({ entries: { ...s.entries, [entry.trackableId]: entry } })),
  skip: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.entries;
      return { entries: rest };
    }),
  set: (patch) => set(patch),
  reset: () => set({ entries: {}, offHours: [], note: '', overall: undefined }),
}));
