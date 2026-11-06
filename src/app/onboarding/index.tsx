import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Notice, ProgressBar, Text } from '@/components/ui';
import {
  onboardingSchema,
  STEP_ORDER,
  toProfileUpdate,
  validateStep,
} from '@/features/onboarding/schema';
import { STEP_COMPONENTS } from '@/features/onboarding/Steps';
import { useOnboardingDraft } from '@/features/onboarding/store';
import { useProgramGeneration } from '@/features/program/store';
import { useUpdateProfile } from '@/features/profile/api';
import { useSettings } from '@/stores/settings';

/**
 * Step-by-step onboarding. Each step validates only its own fields; the last one validates
 * everything, saves the profile and marks onboarding as done, which switches the router to the app.
 */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { draft, patch, step, setStep, reset } = useOnboardingDraft();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const updateProfile = useUpdateProfile();
  const setUnit = useSettings((s) => s.setUnit);
  const setAutoStart = useProgramGeneration((s) => s.setAutoStart);

  const stepId = STEP_ORDER[step] ?? 'consent';
  const StepView = STEP_COMPONENTS[stepId];
  const isLast = step === STEP_ORDER.length - 1;

  function next() {
    const stepErrors = validateStep(stepId, draft);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length) return;
    if (!isLast) return setStep(step + 1);

    const answers = onboardingSchema.safeParse(draft);
    if (!answers.success) {
      // A previous step became invalid (should not happen): send the user back to it.
      const field = String(answers.error.issues[0]?.path[0]);
      const back = STEP_ORDER.findIndex((s) => Object.keys(validateStep(s, draft)).includes(field));
      return setStep(Math.max(0, back));
    }
    updateProfile.mutate(toProfileUpdate(answers.data), {
      onSuccess: () => {
        setUnit(answers.data.weightUnit);
        setAutoStart(true); // Today starts generating the first program right away
        reset();
      },
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-ink-50 dark:bg-ink-950">
      <View className="w-full max-w-xl flex-1 self-center">
        <View className="gap-3 px-5 pt-4">
          <ProgressBar
            value={(step + 1) / STEP_ORDER.length}
            label={t('onboarding.progress', { current: step + 1, total: STEP_ORDER.length })}
          />
          <Text variant="caption">
            {t('onboarding.progress', { current: step + 1, total: STEP_ORDER.length })}
          </Text>
        </View>
        <ScrollView contentContainerClassName="gap-6 px-5 py-6" keyboardShouldPersistTaps="handled">
          <View className="gap-2">
            <Text variant="title">{t(`onboarding.steps.${stepId}.title`)}</Text>
            <Text variant="caption">{t(`onboarding.steps.${stepId}.body`)}</Text>
          </View>
          <StepView draft={draft} patch={patch} errors={errors} />
          {updateProfile.isError ? (
            <Notice tone="danger">{t('onboarding.saveError')}</Notice>
          ) : null}
        </ScrollView>
        <View className="flex-row gap-3 border-t border-ink-100 px-5 py-4 dark:border-ink-800">
          {step > 0 ? (
            <View className="flex-1">
              <Button
                variant="secondary"
                label={t('onboarding.back')}
                onPress={() => {
                  setErrors({});
                  setStep(step - 1);
                }}
              />
            </View>
          ) : null}
          <View className="flex-[2]">
            <Button
              label={isLast ? t('onboarding.finish') : t('onboarding.next')}
              loading={updateProfile.isPending}
              onPress={next}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
