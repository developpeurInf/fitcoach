import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { OnboardingDraft } from './schema';

type DraftState = {
  draft: OnboardingDraft;
  step: number;
  patch: (values: OnboardingDraft) => void;
  setStep: (step: number) => void;
  reset: () => void;
};

const initialDraft: OnboardingDraft = {
  weightUnit: 'kg',
  secondaryGoals: [],
  equipment: [],
  injuries: [],
  conditions: [],
};

/** Onboarding answers in progress, persisted so closing the app mid-way doesn't lose them. */
export const useOnboardingDraft = create<DraftState>()(
  persist(
    (set) => ({
      draft: initialDraft,
      step: 0,
      patch: (values) => set((s) => ({ draft: { ...s.draft, ...values } })),
      setStep: (step) => set({ step }),
      reset: () => set({ draft: initialDraft, step: 0 }),
    }),
    { name: 'fitcoach-onboarding', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
