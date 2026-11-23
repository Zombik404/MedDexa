import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from '@/lib/storage';

/**
 * On-device data for guests (no account needed). After sign-in, favourites are synced to
 * the account and the server becomes the source of truth.
 */
interface LocalState {
  recentSearches: string[];
  favoriteMedicines: { id: string; name: string }[];
  favoritePharmacies: { id: string; name: string }[];
  recentMedicines: { id: string; name: string }[];
  recentPharmacies: { id: string; name: string }[];
  addSearch: (q: string) => void;
  clearSearches: () => void;
  toggleFavoriteMedicine: (m: { id: string; name: string }) => boolean;
  toggleFavoritePharmacy: (p: { id: string; name: string }) => boolean;
  viewedMedicine: (m: { id: string; name: string }) => void;
  viewedPharmacy: (p: { id: string; name: string }) => void;
  clearAll: () => void;
}

const pushUnique = <T extends { id: string }>(list: T[], item: T, max = 20) => [item, ...list.filter((i) => i.id !== item.id)].slice(0, max);

export const useLocal = create<LocalState>()(
  persist(
    (set, get) => ({
      recentSearches: [],
      favoriteMedicines: [],
      favoritePharmacies: [],
      recentMedicines: [],
      recentPharmacies: [],
      addSearch: (q) => {
        const t = q.trim();
        if (!t) return;
        set({ recentSearches: [t, ...get().recentSearches.filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, 10) });
      },
      clearSearches: () => set({ recentSearches: [] }),
      toggleFavoriteMedicine: (m) => {
        const exists = get().favoriteMedicines.some((f) => f.id === m.id);
        set({ favoriteMedicines: exists ? get().favoriteMedicines.filter((f) => f.id !== m.id) : pushUnique(get().favoriteMedicines, m, 200) });
        return !exists;
      },
      toggleFavoritePharmacy: (p) => {
        const exists = get().favoritePharmacies.some((f) => f.id === p.id);
        set({ favoritePharmacies: exists ? get().favoritePharmacies.filter((f) => f.id !== p.id) : pushUnique(get().favoritePharmacies, p, 200) });
        return !exists;
      },
      viewedMedicine: (m) => set({ recentMedicines: pushUnique(get().recentMedicines, m) }),
      viewedPharmacy: (p) => set({ recentPharmacies: pushUnique(get().recentPharmacies, p) }),
      clearAll: () => set({ recentSearches: [], favoriteMedicines: [], favoritePharmacies: [], recentMedicines: [], recentPharmacies: [] }),
    }),
    { name: 'meddexa.local', storage: persistStorage, version: 1 },
  ),
);
