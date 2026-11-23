import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from '@/lib/storage';

export type ThemePreference = 'system' | 'light' | 'dark';

interface PreferencesState {
  language: string | null; // null = follow device
  currency: string;
  theme: ThemePreference;
  countryCode: string | null;
  onboardingDone: boolean;
  disclaimerAccepted: boolean;
  saveSearchHistory: boolean;
  set: (patch: Partial<Omit<PreferencesState, 'set'>>) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      language: null,
      currency: 'EUR',
      theme: 'system',
      countryCode: null,
      onboardingDone: false,
      disclaimerAccepted: false,
      saveSearchHistory: true,
      set: (patch) => set(patch),
    }),
    { name: 'meddexa.preferences', storage: persistStorage, version: 1 },
  ),
);
