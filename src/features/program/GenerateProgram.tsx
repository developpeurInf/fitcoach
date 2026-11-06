import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Button, Notice, ProgressBar, Text } from '@/components/ui';
import { FunctionError } from '@/lib/functions';
import { colors } from '@/theme/tokens';

import { useGenerateProgram } from './api';
import { useProgramGeneration } from './store';

/**
 * Empty state of Today when there is no program: starts the AI generation (automatically right
 * after onboarding), shows progress while the Edge Function works, and clear errors with retry.
 */
export function GenerateProgram() {
  const { t } = useTranslation();
  const generate = useGenerateProgram();
  const { autoStart, setAutoStart } = useProgramGeneration();
  const steps = t('program.generate.steps', { returnObjects: true }) as string[];
  const [step, setStep] = useState(0);
  const started = useRef(false);

  const { mutate } = generate;
  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      setAutoStart(false);
      mutate();
    }
  }, [autoStart, setAutoStart, mutate]);

  const start = () => {
    setStep(0);
    mutate();
  };

  // Rotating status messages: the call takes ~30-60 s and has no real progress events.
  useEffect(() => {
    if (!generate.isPending) return;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 9000);
    return () => clearInterval(id);
  }, [generate.isPending, steps.length]);

  const code = generate.error instanceof FunctionError ? generate.error.code : 'default';
  const errorKey = (['rate_limited', 'ai_invalid_output', 'network'] as const).includes(
    code as never,
  )
    ? (code as 'rate_limited' | 'ai_invalid_output' | 'network')
    : 'default';

  return (
    <View className="gap-5 rounded-2xl border border-ink-100 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
      <View className="gap-2">
        <Text variant="heading">{t('program.generate.title')}</Text>
        <Text variant="caption">{t('program.generate.body')}</Text>
      </View>
      {generate.isPending ? (
        <View className="gap-3" accessibilityLiveRegion="polite">
          <View className="flex-row items-center gap-3">
            <ActivityIndicator color={colors.accent.DEFAULT} />
            <Text className="flex-1 font-semibold">{steps[step]}</Text>
          </View>
          <ProgressBar value={(step + 1) / (steps.length + 1)} />
          <Text variant="caption">{t('program.generate.wait')}</Text>
        </View>
      ) : (
        <>
          {generate.isError ? (
            <Notice tone="danger">{t(`program.generate.errors.${errorKey}`)}</Notice>
          ) : null}
          <Button
            label={generate.isError ? t('program.generate.retry') : t('program.generate.cta')}
            onPress={start}
          />
        </>
      )}
    </View>
  );
}
