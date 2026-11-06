import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { WeightUnit } from '@/lib/units';

export type ThemePreference = 'dark' | 'light' | 'system';
/** Multiplier applied to text sizes for accessibility (Paramètres > Taille du texte). */
export type FontScale = 1 | 1.15 | 1.3;

type SettingsState = {
  theme: ThemePreference;
  unit: WeightUnit;
  fontScale: FontScale;
  setTheme: (theme: ThemePreference) => void;
  setUnit: (unit: WeightUnit) => void;
  setFontScale: (scale: FontScale) => void;
};

/** Local UI preferences, persisted on device. Profile data lives in Supabase, not here. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark', // dark mode by default (spec §6)
      unit: 'kg',
      fontScale: 1,
      setTheme: (theme) => set({ theme }),
      setUnit: (unit) => set({ unit }),
      setFontScale: (fontScale) => set({ fontScale }),
    }),
    { name: 'fitcoach-settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
