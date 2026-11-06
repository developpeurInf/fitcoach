import { create } from 'zustand';

/**
 * Set when onboarding finishes so the Today screen starts generating the first program
 * right away (spec §3.1: "À la fin, appel à l'IA pour générer le programme complet").
 */
export const useProgramGeneration = create<{
  autoStart: boolean;
  setAutoStart: (v: boolean) => void;
}>((set) => ({
  autoStart: false,
  setAutoStart: (autoStart) => set({ autoStart }),
}));
