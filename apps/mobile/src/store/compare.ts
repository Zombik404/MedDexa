import { MAX_COMPARE } from '@meddexa/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from '@/lib/storage';

export interface CompareItem {
  id: string;
  name: string;
}

interface CompareState {
  items: CompareItem[];
  /** Guest comparison history kept on the device. Signed-in history lives on the server. */
  localHistory: { ids: string[]; names: string[]; at: string }[];
  toggle: (item: CompareItem) => 'added' | 'removed' | 'full';
  remove: (id: string) => void;
  replace: (items: CompareItem[]) => void;
  makeReference: (id: string) => void;
  clear: () => void;
  remember: (items: CompareItem[]) => void;
}

export const useCompare = create<CompareState>()(
  persist(
    (set, get) => ({
      items: [],
      localHistory: [],
      toggle: (item) => {
        const { items } = get();
        if (items.some((i) => i.id === item.id)) {
          set({ items: items.filter((i) => i.id !== item.id) });
          return 'removed';
        }
        if (items.length >= MAX_COMPARE) return 'full';
        set({ items: [...items, item] });
        return 'added';
      },
      remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
      replace: (items) => set({ items: items.slice(0, MAX_COMPARE) }),
      makeReference: (id) => {
        const items = get().items;
        const ref = items.find((i) => i.id === id);
        if (ref) set({ items: [ref, ...items.filter((i) => i.id !== id)] });
      },
      clear: () => set({ items: [] }),
      remember: (items) => {
        const ids = items.map((i) => i.id);
        const key = ids.join(',');
        const rest = get().localHistory.filter((h) => h.ids.join(',') !== key);
        set({ localHistory: [{ ids, names: items.map((i) => i.name), at: new Date().toISOString() }, ...rest].slice(0, 20) });
      },
    }),
    { name: 'meddexa.compare', storage: persistStorage, version: 1 },
  ),
);
