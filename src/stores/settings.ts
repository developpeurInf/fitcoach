import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ReminderTime } from '@/features/reminders/logic';
import type { WeightUnit } from '@/lib/units';

export type ThemePreference = 'dark' | 'light' | 'system';
/** Multiplier applied to text sizes for accessibility (Paramètres > Taille du texte). */
export type FontScale = 1 | 1.15 | 1.3;

type SettingsState = {
  theme: ThemePreference;
  unit: WeightUnit;
  fontScale: FontScale;
  /** Local notification on planned session days (mobile app only). */
  reminders: boolean;
  reminderTime: ReminderTime;
  setTheme: (theme: ThemePreference) => void;
  setUnit: (unit: WeightUnit) => void;
  setFontScale: (scale: FontScale) => void;
  setReminders: (on: boolean) => void;
  setReminderTime: (time: ReminderTime) => void;
};

/** Local UI preferences, persisted on device. Profile data lives in Supabase, not here. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark', // dark mode by default (spec §6)
      unit: 'kg',
      fontScale: 1,
      reminders: false,
      reminderTime: '17:30',
      setTheme: (theme) => set({ theme }),
      setUnit: (unit) => set({ unit }),
      setFontScale: (fontScale) => set({ fontScale }),
      setReminders: (reminders) => set({ reminders }),
      setReminderTime: (reminderTime) => set({ reminderTime }),
    }),
    { name: 'fitcoach-settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
