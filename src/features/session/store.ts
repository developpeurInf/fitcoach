import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  addSet,
  completeSet,
  type LoggedSet,
  type Pain,
  removeLastSet,
  type SessionExercise,
} from './logic';

export type ActiveSession = {
  userId: string;
  workoutId: string | null;
  title: string;
  performedOn: string;
  startedAt: string;
  exercises: SessionExercise[];
  currentIndex: number;
  pains: Pain[];
  /** Epoch ms when the current rest ends, null when not resting. */
  restEndsAt: number | null;
  restTotalSec: number;
};

type SessionState = {
  active: ActiveSession | null;
  start: (
    session: Omit<ActiveSession, 'currentIndex' | 'pains' | 'restEndsAt' | 'restTotalSec'>,
  ) => void;
  goTo: (index: number) => void;
  updateSet: (exerciseIndex: number, setIndex: number, patch: Partial<LoggedSet>) => void;
  /** Marks the set done and starts the rest timer with the exercise's rest time. */
  completeSet: (exerciseIndex: number, setIndex: number) => void;
  reopenSet: (exerciseIndex: number, setIndex: number) => void;
  addSet: (exerciseIndex: number) => void;
  removeLastSet: (exerciseIndex: number) => void;
  replaceExercise: (exerciseIndex: number, exercise: SessionExercise) => void;
  reportPain: (pain: Pain) => void;
  addRest: (seconds: number) => void;
  skipRest: () => void;
  clear: () => void;
};

/**
 * The session in progress, persisted on the device: logging works offline and survives the app
 * being closed. It is saved to Supabase in one go at the end (finish_workout).
 */
export const useSession = create<SessionState>()(
  persist(
    (set, get) => {
      const patchExercise = (index: number, fn: (e: SessionExercise) => SessionExercise) => {
        const active = get().active;
        const exercise = active?.exercises[index];
        if (!active || !exercise) return;
        const exercises = [...active.exercises];
        exercises[index] = fn(exercise);
        set({ active: { ...active, exercises } });
      };
      const patchActive = (patch: Partial<ActiveSession>) => {
        const active = get().active;
        if (active) set({ active: { ...active, ...patch } });
      };

      return {
        active: null,
        start: (session) =>
          set({
            active: { ...session, currentIndex: 0, pains: [], restEndsAt: null, restTotalSec: 0 },
          }),
        goTo: (index) => {
          const active = get().active;
          if (active && index >= 0 && index < active.exercises.length) {
            patchActive({ currentIndex: index });
          }
        },
        updateSet: (exerciseIndex, setIndex, patch) =>
          patchExercise(exerciseIndex, (e) => ({
            ...e,
            sets: e.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)),
          })),
        completeSet: (exerciseIndex, setIndex) => {
          patchExercise(exerciseIndex, (e) => completeSet(e, setIndex));
          const rest = get().active?.exercises[exerciseIndex]?.restSec ?? 0;
          if (rest > 0) patchActive({ restEndsAt: Date.now() + rest * 1000, restTotalSec: rest });
        },
        reopenSet: (exerciseIndex, setIndex) =>
          patchExercise(exerciseIndex, (e) => ({
            ...e,
            sets: e.sets.map((s, i) =>
              i === setIndex ? { ...s, done: false, performedAt: null } : s,
            ),
          })),
        addSet: (exerciseIndex) => patchExercise(exerciseIndex, addSet),
        removeLastSet: (exerciseIndex) => patchExercise(exerciseIndex, removeLastSet),
        replaceExercise: (exerciseIndex, exercise) => patchExercise(exerciseIndex, () => exercise),
        reportPain: (pain) => patchActive({ pains: [...(get().active?.pains ?? []), pain] }),
        addRest: (seconds) => {
          const active = get().active;
          if (!active?.restEndsAt) return;
          const restEndsAt = Math.max(Date.now(), active.restEndsAt + seconds * 1000);
          patchActive({ restEndsAt, restTotalSec: Math.max(1, active.restTotalSec + seconds) });
        },
        skipRest: () => patchActive({ restEndsAt: null }),
        clear: () => set({ active: null }),
      };
    },
    {
      name: 'fitcoach.session',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
