import { z } from 'zod';

import { toKg, type WeightUnit } from '@/lib/units';
import type { Update } from '@/types/models';

/** Option keys stored in the database; labels come from i18n (onboarding.options.*). */
export const SEXES = ['male', 'female', 'other'] as const;
export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const GOALS = [
  'fat_loss',
  'muscle_gain',
  'strength',
  'endurance',
  'general_fitness',
  'mobility',
  'sport_performance',
] as const;
export const SECONDARY_GOALS = ['abs', 'back', 'posture', 'cardio', 'glutes', 'arms'] as const;
export const LOCATIONS = ['gym', 'home', 'outdoor'] as const;
export const SESSION_MINUTES = [30, 45, 60, 75, 90] as const;
export const EQUIPMENT = [
  'none',
  'dumbbells',
  'barbell',
  'bench',
  'rack',
  'machines',
  'cables',
  'kettlebell',
  'bands',
  'pullup_bar',
  'cardio_machines',
] as const;
export const INJURIES = [
  'shoulder',
  'knee',
  'lower_back',
  'wrist',
  'elbow',
  'hip',
  'ankle',
  'neck',
] as const;
/** Conditions for which the coach must recommend medical advice before starting (context §2). */
export const CONDITIONS = [
  'pregnancy',
  'heart_condition',
  'hypertension',
  'diabetes',
  'recent_surgery',
] as const;

const currentYear = () => new Date().getFullYear();

/** One schema per step, so each screen validates only what it shows. */
export const stepSchemas = {
  consent: z.object({
    healthDisclaimer: z.literal(true, { error: 'onboarding.errors.healthDisclaimer' }),
    gdprConsent: z.literal(true, { error: 'onboarding.errors.gdprConsent' }),
  }),
  about: z.object({
    firstName: z.string().trim().min(1, 'onboarding.errors.firstName').max(60),
    age: z
      .number({ error: 'onboarding.errors.age' })
      .int()
      .min(13, 'onboarding.errors.ageMin')
      .max(100, 'onboarding.errors.age'),
    sex: z.enum(SEXES, { error: 'onboarding.errors.required' }),
  }),
  body: z.object({
    heightCm: z
      .number({ error: 'onboarding.errors.height' })
      .min(120, 'onboarding.errors.height')
      .max(230, 'onboarding.errors.height'),
    // Typed in the user's unit; converted to kg on save.
    weight: z.number({ error: 'onboarding.errors.weight' }).positive('onboarding.errors.weight'),
    weightUnit: z.enum(['kg', 'lb']),
  }),
  level: z.object({ level: z.enum(LEVELS, { error: 'onboarding.errors.required' }) }),
  goals: z.object({
    mainGoal: z.enum(GOALS, { error: 'onboarding.errors.required' }),
    secondaryGoals: z.array(z.enum(SECONDARY_GOALS)).max(3),
  }),
  schedule: z.object({
    daysPerWeek: z.number({ error: 'onboarding.errors.required' }).int().min(1).max(6),
    sessionMinutes: z.number({ error: 'onboarding.errors.required' }).int().min(10).max(180),
    location: z.enum(LOCATIONS, { error: 'onboarding.errors.required' }),
  }),
  equipment: z.object({
    equipment: z.array(z.enum(EQUIPMENT)).min(1, 'onboarding.errors.equipment'),
  }),
  health: z.object({
    injuries: z.array(z.enum(INJURIES)),
    conditions: z.array(z.enum(CONDITIONS)),
    experience: z.string().trim().max(1000).optional(),
  }),
} as const;

export type StepId = keyof typeof stepSchemas;
export const STEP_ORDER: StepId[] = [
  'consent',
  'about',
  'body',
  'level',
  'goals',
  'schedule',
  'equipment',
  'health',
];

/** Full onboarding answers: the union of every step, with weight bounds checked in kg. */
export const onboardingSchema = stepSchemas.consent
  .extend(stepSchemas.about.shape)
  .extend(stepSchemas.body.shape)
  .extend(stepSchemas.level.shape)
  .extend(stepSchemas.goals.shape)
  .extend(stepSchemas.schedule.shape)
  .extend(stepSchemas.equipment.shape)
  .extend(stepSchemas.health.shape)
  .superRefine((v, ctx) => {
    if (!isWeightInRange(v.weight, v.weightUnit)) {
      ctx.addIssue({ code: 'custom', path: ['weight'], message: 'onboarding.errors.weight' });
    }
  });

export type OnboardingAnswers = z.infer<typeof onboardingSchema>;
export type OnboardingDraft = Partial<OnboardingAnswers>;

/** Validates one step of the draft. Returns a map field → i18n error key (empty when valid). */
export function validateStep(step: StepId, draft: OnboardingDraft): Record<string, string> {
  const result = stepSchemas[step].safeParse(draft);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      errors[key] ??= issue.message;
    }
    return errors;
  }
  if (step === 'body' && !isWeightInRange(draft.weight!, draft.weightUnit!)) {
    return { weight: 'onboarding.errors.weight' };
  }
  return {};
}

const isWeightInRange = (weight: number, unit: WeightUnit) => {
  const kg = toKg(weight, unit);
  return kg >= 30 && kg <= 300;
};

/** True when the coach must recommend medical advice before training (context §2). */
export function needsMedicalAdvice(a: Pick<OnboardingDraft, 'age' | 'conditions'>): boolean {
  return (a.age !== undefined && a.age < 18) || (a.conditions?.length ?? 0) > 0;
}

/** Maps validated answers to the profiles row. Conditions are stored with the injuries list. */
export function toProfileUpdate(a: OnboardingAnswers, now = new Date()): Update<'profiles'> {
  const iso = now.toISOString();
  return {
    first_name: a.firstName.trim(),
    birth_year: currentYear() - a.age,
    sex: a.sex,
    height_cm: a.heightCm,
    weight_kg: Math.round(toKg(a.weight, a.weightUnit) * 10) / 10,
    weight_unit: a.weightUnit,
    level: a.level,
    main_goal: a.mainGoal,
    secondary_goals: a.secondaryGoals,
    days_per_week: a.daysPerWeek,
    session_minutes: a.sessionMinutes,
    location: a.location,
    equipment: a.equipment,
    injuries: [...a.injuries, ...a.conditions.map((c) => `condition:${c}`)],
    experience: a.experience?.trim() || null,
    health_disclaimer_accepted_at: iso,
    gdpr_consent_at: iso,
    onboarding_completed_at: iso,
  };
}
