import {
  needsMedicalAdvice,
  onboardingSchema,
  toProfileUpdate,
  validateStep,
  type OnboardingAnswers,
} from '../schema';

const valid: OnboardingAnswers = {
  healthDisclaimer: true,
  gdprConsent: true,
  firstName: ' Ahmed ',
  age: 27,
  sex: 'male',
  heightCm: 178,
  weight: 82,
  weightUnit: 'kg',
  level: 'intermediate',
  mainGoal: 'muscle_gain',
  secondaryGoals: ['abs', 'back'],
  daysPerWeek: 4,
  sessionMinutes: 60,
  location: 'gym',
  equipment: ['barbell', 'dumbbells', 'machines'],
  injuries: ['shoulder'],
  conditions: [],
  experience: '2 ans de salle',
};

describe('onboarding validation', () => {
  it('accepts a complete profile', () => {
    expect(onboardingSchema.safeParse(valid).success).toBe(true);
  });

  it('requires both consents', () => {
    expect(validateStep('consent', { healthDisclaimer: true })).toEqual({
      gdprConsent: 'onboarding.errors.gdprConsent',
    });
  });

  it('rejects users under 13', () => {
    expect(validateStep('about', { firstName: 'Léa', age: 12, sex: 'female' })).toEqual({
      age: 'onboarding.errors.ageMin',
    });
  });

  it('checks weight bounds in kg whatever the unit', () => {
    expect(validateStep('body', { heightCm: 180, weight: 180, weightUnit: 'lb' })).toEqual({}); // 81.6 kg
    expect(validateStep('body', { heightCm: 180, weight: 700, weightUnit: 'lb' })).toEqual({
      weight: 'onboarding.errors.weight',
    });
  });

  it('requires at least one equipment option', () => {
    expect(validateStep('equipment', { equipment: [] })).toEqual({
      equipment: 'onboarding.errors.equipment',
    });
  });

  it('flags minors and health conditions for medical advice', () => {
    expect(needsMedicalAdvice({ age: 16, conditions: [] })).toBe(true);
    expect(needsMedicalAdvice({ age: 30, conditions: ['hypertension'] })).toBe(true);
    expect(needsMedicalAdvice({ age: 30, conditions: [] })).toBe(false);
  });
});

describe('toProfileUpdate', () => {
  const now = new Date('2026-11-06T10:00:00Z');

  it('maps answers to the profiles row', () => {
    const row = toProfileUpdate({ ...valid, conditions: ['diabetes'] }, now);
    expect(row).toMatchObject({
      first_name: 'Ahmed',
      birth_year: now.getFullYear() - 27,
      weight_kg: 82,
      injuries: ['shoulder', 'condition:diabetes'],
      onboarding_completed_at: now.toISOString(),
      gdpr_consent_at: now.toISOString(),
      health_disclaimer_accepted_at: now.toISOString(),
    });
  });

  it('stores weight in kg when typed in lb', () => {
    expect(toProfileUpdate({ ...valid, weight: 180, weightUnit: 'lb' }, now).weight_kg).toBe(81.6);
  });
});
