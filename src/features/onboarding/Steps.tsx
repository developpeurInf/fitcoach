import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Checkbox, ChipGroup, Notice, Text, TextField, toggle } from '@/components/ui';

import {
  CONDITIONS,
  EQUIPMENT,
  GOALS,
  INJURIES,
  LEVELS,
  LOCATIONS,
  needsMedicalAdvice,
  SECONDARY_GOALS,
  SESSION_MINUTES,
  SEXES,
  type OnboardingDraft,
  type StepId,
} from './schema';

export type StepProps = {
  draft: OnboardingDraft;
  patch: (values: OnboardingDraft) => void;
  /** field → i18n key */
  errors: Record<string, string>;
};

/** Parses a numeric text input; empty or invalid text becomes undefined (shown as an error on submit). */
const num = (text: string) => {
  const n = Number(text.replace(',', '.'));
  return text.trim() === '' || Number.isNaN(n) ? undefined : n;
};

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text variant="caption" className="font-semibold uppercase tracking-wide">
        {label}
      </Text>
      {children}
      {error ? <Text variant="error">{error}</Text> : null}
    </View>
  );
}

function useErr(errors: Record<string, string>) {
  const { t } = useTranslation();
  return (k: string) => (errors[k] ? t(errors[k] as 'onboarding.errors.required') : undefined);
}

function ConsentStep({ draft, patch, errors }: StepProps) {
  const { t } = useTranslation();
  const err = useErr(errors);
  return (
    <View className="gap-5">
      <Notice tone="warning" title={t('onboarding.consent.disclaimerTitle')}>
        {t('onboarding.consent.disclaimer')}
      </Notice>
      <Checkbox
        checked={!!draft.healthDisclaimer}
        onChange={(v) => patch({ healthDisclaimer: v || undefined })}
        error={err('healthDisclaimer')}
      >
        {t('onboarding.consent.healthCheckbox')}
      </Checkbox>
      <Notice title={t('onboarding.consent.gdprTitle')}>{t('onboarding.consent.gdpr')}</Notice>
      <Checkbox
        checked={!!draft.gdprConsent}
        onChange={(v) => patch({ gdprConsent: v || undefined })}
        error={err('gdprConsent')}
      >
        {t('onboarding.consent.gdprCheckbox')}
      </Checkbox>
    </View>
  );
}

function AboutStep({ draft, patch, errors }: StepProps) {
  const { t } = useTranslation();
  const err = useErr(errors);
  return (
    <View className="gap-5">
      <TextField
        label={t('onboarding.fields.firstName')}
        value={draft.firstName ?? ''}
        onChangeText={(v) => patch({ firstName: v })}
        error={err('firstName')}
        autoComplete="given-name"
        autoCapitalize="words"
      />
      <TextField
        label={t('onboarding.fields.age')}
        value={draft.age?.toString() ?? ''}
        onChangeText={(v) => patch({ age: num(v) })}
        error={err('age')}
        keyboardType="number-pad"
        maxLength={3}
      />
      {draft.age !== undefined && draft.age >= 13 && draft.age < 18 ? (
        <Notice tone="warning">{t('onboarding.warnings.minor')}</Notice>
      ) : null}
      <Field label={t('onboarding.fields.sex')} error={err('sex')}>
        <ChipGroup
          options={SEXES.map((v) => ({ value: v, label: t(`onboarding.options.sex.${v}`) }))}
          value={draft.sex}
          onChange={(sex) => patch({ sex })}
        />
      </Field>
    </View>
  );
}

function BodyStep({ draft, patch, errors }: StepProps) {
  const { t } = useTranslation();
  const err = useErr(errors);
  const unit = draft.weightUnit ?? 'kg';
  return (
    <View className="gap-5">
      <TextField
        label={t('onboarding.fields.height')}
        value={draft.heightCm?.toString() ?? ''}
        onChangeText={(v) => patch({ heightCm: num(v) })}
        error={err('heightCm')}
        keyboardType="decimal-pad"
        suffix="cm"
        maxLength={5}
      />
      <Field label={t('onboarding.fields.unit')}>
        <ChipGroup
          options={[
            { value: 'kg', label: 'kg' },
            { value: 'lb', label: 'lb' },
          ]}
          value={unit}
          onChange={(weightUnit) => patch({ weightUnit })}
        />
      </Field>
      <TextField
        label={t('onboarding.fields.weight')}
        value={draft.weight?.toString() ?? ''}
        onChangeText={(v) => patch({ weight: num(v) })}
        error={err('weight')}
        keyboardType="decimal-pad"
        suffix={unit}
        maxLength={5}
      />
    </View>
  );
}

function LevelStep({ draft, patch, errors }: StepProps) {
  const { t } = useTranslation();
  const err = useErr(errors);
  return (
    <Field label="" error={err('level')}>
      <ChipGroup
        layout="list"
        options={LEVELS.map((v) => ({
          value: v,
          label: t(`onboarding.options.level.${v}`),
          description: t(`onboarding.options.levelDesc.${v}`),
        }))}
        value={draft.level}
        onChange={(level) => patch({ level })}
      />
    </Field>
  );
}

function GoalsStep({ draft, patch, errors }: StepProps) {
  const { t } = useTranslation();
  const err = useErr(errors);
  return (
    <View className="gap-6">
      <Field label="" error={err('mainGoal')}>
        <ChipGroup
          layout="list"
          options={GOALS.map((v) => ({ value: v, label: t(`onboarding.options.goal.${v}`) }))}
          value={draft.mainGoal}
          onChange={(mainGoal) => patch({ mainGoal })}
        />
      </Field>
      <Field label={t('onboarding.fields.secondaryGoals')}>
        <ChipGroup
          multiple
          options={SECONDARY_GOALS.map((v) => ({
            value: v,
            label: t(`onboarding.options.secondary.${v}`),
          }))}
          value={draft.secondaryGoals}
          onChange={(v) => {
            const next = toggle(draft.secondaryGoals, v);
            if (next.length <= 3) patch({ secondaryGoals: next });
          }}
        />
      </Field>
    </View>
  );
}

function ScheduleStep({ draft, patch, errors }: StepProps) {
  const { t } = useTranslation();
  const err = useErr(errors);
  return (
    <View className="gap-6">
      <Field label={t('onboarding.fields.daysPerWeek')} error={err('daysPerWeek')}>
        <ChipGroup
          options={[1, 2, 3, 4, 5, 6].map((v) => ({ value: v, label: String(v) }))}
          value={draft.daysPerWeek}
          onChange={(daysPerWeek) => patch({ daysPerWeek })}
        />
      </Field>
      {draft.daysPerWeek === 6 && draft.level === 'beginner' ? (
        <Notice tone="warning">{t('onboarding.warnings.sixDaysBeginner')}</Notice>
      ) : null}
      <Field label={t('onboarding.fields.sessionMinutes')} error={err('sessionMinutes')}>
        <ChipGroup
          options={SESSION_MINUTES.map((v) => ({
            value: v,
            label: t('onboarding.fields.minutes', { count: v }),
          }))}
          value={draft.sessionMinutes}
          onChange={(sessionMinutes) => patch({ sessionMinutes })}
        />
      </Field>
      <Field label={t('onboarding.fields.location')} error={err('location')}>
        <ChipGroup
          options={LOCATIONS.map((v) => ({
            value: v,
            label: t(`onboarding.options.location.${v}`),
          }))}
          value={draft.location}
          onChange={(location) => patch({ location })}
        />
      </Field>
    </View>
  );
}

function EquipmentStep({ draft, patch, errors }: StepProps) {
  const { t } = useTranslation();
  const err = useErr(errors);
  return (
    <Field label="" error={err('equipment')}>
      <ChipGroup
        multiple
        options={EQUIPMENT.map((v) => ({
          value: v,
          label: t(`onboarding.options.equipment.${v}`),
        }))}
        value={draft.equipment}
        onChange={(v) => {
          // "None" is exclusive with every other item.
          const next =
            v === 'none'
              ? ['none' as const]
              : toggle(draft.equipment, v).filter((e) => e !== 'none');
          patch({ equipment: next });
        }}
      />
    </Field>
  );
}

function HealthStep({ draft, patch }: StepProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-6">
      <Field label={t('onboarding.fields.injuries')}>
        <ChipGroup
          multiple
          options={INJURIES.map((v) => ({ value: v, label: t(`onboarding.options.injury.${v}`) }))}
          value={draft.injuries}
          onChange={(v) => patch({ injuries: toggle(draft.injuries, v) })}
        />
      </Field>
      <Field label={t('onboarding.fields.conditions')}>
        <ChipGroup
          multiple
          options={CONDITIONS.map((v) => ({
            value: v,
            label: t(`onboarding.options.condition.${v}`),
          }))}
          value={draft.conditions}
          onChange={(v) => patch({ conditions: toggle(draft.conditions, v) })}
        />
      </Field>
      {needsMedicalAdvice(draft) ? (
        <Notice tone="warning">{t('onboarding.warnings.medical')}</Notice>
      ) : null}
      <TextField
        label={t('onboarding.fields.experience')}
        placeholder={t('onboarding.fields.experiencePlaceholder')}
        value={draft.experience ?? ''}
        onChangeText={(experience) => patch({ experience })}
        multiline
        maxLength={1000}
      />
    </View>
  );
}

export const STEP_COMPONENTS: Record<StepId, (p: StepProps) => React.ReactElement> = {
  consent: ConsentStep,
  about: AboutStep,
  body: BodyStep,
  level: LevelStep,
  goals: GoalsStep,
  schedule: ScheduleStep,
  equipment: EquipmentStep,
  health: HealthStep,
};
