// Pure session logic (no React, no Supabase): building a session from the plan and the last
// performance, pre-filling sets, the rest timer, the summary and the payload saved at the end.
import type { WorkoutWithExercises } from '@/features/program/api';

export type LoggedSet = {
  setNumber: number;
  reps: number | null;
  loadKg: number | null;
  durationSec: number | null;
  rpe: number | null;
  done: boolean;
  performedAt: string | null;
};

export type SessionExercise = {
  workoutExerciseId: string | null;
  exerciseId: string;
  nameFr: string;
  nameEn: string;
  imageUrl: string | null;
  gifUrl: string | null;
  youtubeVideoId: string | null;
  targetSets: number;
  targetReps: string;
  targetDurationSec: number | null;
  suggestedLoadKg: number | null;
  tempo: string | null;
  restSec: number;
  targetRpe: number | null;
  notes: string | null;
  /** What the user did last time on this exercise (by set number), shown as a hint. */
  previous: PreviousSet[];
  sets: LoggedSet[];
};

export type PreviousSet = {
  set_number: number;
  reps: number | null;
  load_kg: number | null;
  duration_sec: number | null;
  rpe: number | null;
};

/** Pain reported during a session (workout_logs.pains, context §8.4 "douleurs"). */
export type Pain = { exercise_id: string; zone: string; intensite: number; note?: string };

export type Feedback = { feeling: number; energy: number; comment: string };

export const DEFAULT_REST_SEC = 90;
/** At or above this intensity (out of 10), the coach's rule is to stop (context §2). */
export const SEVERE_PAIN = 7;

/** "8" → 8, "6-8" → 6 (start at the bottom of the range, then progress to the top). */
export function targetRepsValue(reps: string): number | null {
  const n = Number.parseInt(reps, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Epley, same formula as the set_logs.estimated_1rm_kg generated column. */
export function estimate1RM(loadKg: number, reps: number): number {
  if (loadKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return loadKg;
  return Math.round(loadKg * (1 + reps / 30) * 100) / 100;
}

/**
 * Values pre-filled for a set, by priority:
 * 1. the set just done in this session (same exercise), so set 3 starts from set 2;
 * 2. the same set last time;
 * 3. the plan (target reps / duration and suggested load).
 */
export function prefillSet(
  exercise: Pick<
    SessionExercise,
    'targetReps' | 'targetDurationSec' | 'suggestedLoadKg' | 'previous'
  >,
  setNumber: number,
  doneBefore?: LoggedSet,
): LoggedSet {
  const base = { setNumber, rpe: null, done: false, performedAt: null };
  if (doneBefore) {
    return {
      ...base,
      reps: doneBefore.reps,
      loadKg: doneBefore.loadKg,
      durationSec: doneBefore.durationSec,
    };
  }
  const last =
    exercise.previous.find((p) => p.set_number === setNumber) ?? exercise.previous.at(-1);
  if (last) {
    return { ...base, reps: last.reps, loadKg: last.load_kg, durationSec: last.duration_sec };
  }
  return {
    ...base,
    reps: exercise.targetDurationSec ? null : targetRepsValue(exercise.targetReps),
    loadKg: exercise.suggestedLoadKg,
    durationSec: exercise.targetDurationSec,
  };
}

type PlannedExercise = WorkoutWithExercises['workout_exercises'][number];

export function toSessionExercise(item: PlannedExercise, previous: PreviousSet[]): SessionExercise {
  const exercise: Omit<SessionExercise, 'sets'> = {
    workoutExerciseId: item.id,
    exerciseId: item.exercise_id,
    nameFr: item.exercise?.name_fr ?? item.exercise_id,
    nameEn: item.exercise?.name_en ?? item.exercise_id,
    imageUrl: item.exercise?.image_urls[0] ?? null,
    gifUrl: item.exercise?.gif_url ?? null,
    youtubeVideoId: item.exercise?.youtube_video_id ?? null,
    targetSets: item.sets,
    targetReps: item.reps,
    targetDurationSec: item.duration_sec,
    suggestedLoadKg: item.suggested_load_kg,
    tempo: item.tempo,
    restSec: item.rest_sec ?? DEFAULT_REST_SEC,
    targetRpe: item.target_rpe,
    notes: item.notes,
    previous: [...previous].sort((a, b) => a.set_number - b.set_number),
  };
  return {
    ...exercise,
    sets: Array.from({ length: item.sets }, (_, i) => prefillSet(exercise, i + 1)),
  };
}

/** Marks a set done and pre-fills the next pending set of the same exercise from it. */
export function completeSet(
  exercise: SessionExercise,
  setIndex: number,
  now = new Date(),
): SessionExercise {
  const sets = exercise.sets.map((s, i) =>
    i === setIndex ? { ...s, done: true, performedAt: now.toISOString() } : s,
  );
  const done = sets[setIndex]!;
  const next = sets[setIndex + 1];
  if (next && !next.done) sets[setIndex + 1] = { ...prefillSet(exercise, next.setNumber, done) };
  return { ...exercise, sets };
}

export function addSet(exercise: SessionExercise): SessionExercise {
  const last = exercise.sets.at(-1);
  const setNumber = (last?.setNumber ?? 0) + 1;
  return {
    ...exercise,
    sets: [...exercise.sets, prefillSet(exercise, setNumber, last?.done ? last : undefined)],
  };
}

/** Removes the last set if it was not done yet (a done set is kept: it was performed). */
export function removeLastSet(exercise: SessionExercise): SessionExercise {
  const last = exercise.sets.at(-1);
  if (!last || last.done || exercise.sets.length <= 1) return exercise;
  return { ...exercise, sets: exercise.sets.slice(0, -1) };
}

/** Index of the first pending set, or -1 when the exercise is finished. */
export const currentSetIndex = (exercise: SessionExercise) =>
  exercise.sets.findIndex((s) => !s.done);

export function restSecondsLeft(endsAt: number | null, now = Date.now()): number {
  if (endsAt == null) return 0;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Changes a numeric field by a step, never below 0, rounded to the step's precision. */
export function stepValue(value: number | null, step: number): number {
  const next = Math.max(0, (value ?? 0) + step);
  return Math.round(next * 100) / 100;
}

export type SessionSummary = {
  durationMinutes: number;
  exercisesDone: number;
  setsDone: number;
  totalReps: number;
  volumeKg: number;
};

export function summarize(
  exercises: SessionExercise[],
  startedAt: string,
  finishedAt = new Date(),
): SessionSummary {
  const done = exercises.flatMap((e) => e.sets.filter((s) => s.done));
  return {
    durationMinutes: Math.max(
      0,
      Math.round((finishedAt.getTime() - new Date(startedAt).getTime()) / 60000),
    ),
    exercisesDone: exercises.filter((e) => e.sets.some((s) => s.done)).length,
    setsDone: done.length,
    totalReps: done.reduce((n, s) => n + (s.reps ?? 0), 0),
    volumeKg: Math.round(done.reduce((n, s) => n + (s.reps ?? 0) * (s.loadKg ?? 0), 0)),
  };
}

/** Body of the finish_workout RPC (supabase/migrations/…_finish_workout.sql). Only done sets. */
export function toFinishPayload(input: {
  workoutId: string | null;
  performedOn: string;
  startedAt: string;
  finishedAt: string;
  exercises: SessionExercise[];
  pains: Pain[];
  feedback: Feedback;
}) {
  return {
    workout_id: input.workoutId,
    performed_on: input.performedOn,
    started_at: input.startedAt,
    finished_at: input.finishedAt,
    feeling: input.feedback.feeling,
    energy: input.feedback.energy,
    comment: input.feedback.comment.trim(),
    pains: input.pains,
    sets: input.exercises.flatMap((e) =>
      e.sets
        .filter((s) => s.done)
        .map((s, i) => ({
          exercise_id: e.exerciseId,
          workout_exercise_id: e.workoutExerciseId,
          // Renumbered so skipped sets leave no gap (unique per log + exercise + set number).
          set_number: i + 1,
          reps: s.reps,
          load_kg: s.loadKg,
          duration_sec: s.durationSec,
          rpe: s.rpe,
          performed_at: s.performedAt,
        })),
    ),
  };
}

/**
 * Last performance per exercise: the sets of the most recent session where it was done.
 * Input rows are ordered by performed_at desc.
 */
export function lastPerformance(
  rows: (PreviousSet & { exercise_id: string; workout_log_id: string })[],
): Record<string, PreviousSet[]> {
  const latestLog: Record<string, string> = {};
  const out: Record<string, PreviousSet[]> = {};
  for (const r of rows) {
    latestLog[r.exercise_id] ??= r.workout_log_id;
    if (latestLog[r.exercise_id] !== r.workout_log_id) continue;
    (out[r.exercise_id] ??= []).push({
      set_number: r.set_number,
      reps: r.reps,
      load_kg: r.load_kg,
      duration_sec: r.duration_sec,
      rpe: r.rpe,
    });
  }
  return out;
}
