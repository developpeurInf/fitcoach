import type { Database } from './database';

/** Row shortcuts for app code: `Row<'workouts'>` instead of the long generated path. */
type Tables = Database['public']['Tables'];
export type Row<T extends keyof Tables> = Tables[T]['Row'];
export type Insert<T extends keyof Tables> = Tables[T]['Insert'];
export type Update<T extends keyof Tables> = Tables[T]['Update'];
export type Enum<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

export type Profile = Row<'profiles'>;
export type Exercise = Row<'exercises'>;
export type Program = Row<'programs'>;
export type Workout = Row<'workouts'>;
export type WorkoutExercise = Row<'workout_exercises'>;
export type WorkoutLog = Row<'workout_logs'>;
export type SetLog = Row<'set_logs'>;
export type BodyMeasurement = Row<'body_measurements'>;
export type PersonalRecord = Row<'personal_records'>;
export type CoachReport = Row<'coach_reports'>;
export type ChatMessage = Row<'chat_messages'>;
