import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ChipGroup, Notice, Sheet, Text, TextField } from '@/components/ui';
import { FunctionError } from '@/lib/functions';

import { SWAP_REASONS, type SwapReason } from '@coach/swap';

import { useSwapExercise } from './api';
import type { SessionExercise } from './logic';

type Props = {
  visible: boolean;
  onClose: () => void;
  exerciseIndex: number;
  exercise: SessionExercise;
  initialReason?: SwapReason;
};

/** Asks the coach for a variant of the current exercise (same muscles, user's equipment). */
export function SwapSheet({ visible, onClose, exerciseIndex, exercise, initialReason }: Props) {
  const { t } = useTranslation();
  const swap = useSwapExercise();
  const [reason, setReason] = useState<SwapReason | undefined>(initialReason);
  const [note, setNote] = useState('');

  const close = () => {
    swap.reset();
    setNote('');
    onClose();
  };

  const errorMessage = (e: unknown) => {
    if (e instanceof FunctionError) {
      if (e.code === 'rate_limited') return t('session.swap.rateLimited');
      if (e.code === 'not_found' || e.code === 'bad_request') return e.message;
    }
    return t('session.swap.error');
  };

  return (
    <Sheet visible={visible} title={t('session.swap.title')} onClose={close}>
      {swap.isSuccess ? (
        <>
          <Notice tone="info">{t('session.swap.done')}</Notice>
          <Text variant="heading">{swap.data.exercise.nameFr}</Text>
          <Text>{swap.data.explanation}</Text>
          <Button label={t('common.close')} onPress={close} />
        </>
      ) : (
        <>
          <Text variant="caption" className="font-semibold uppercase tracking-wide">
            {t('session.swap.reason')}
          </Text>
          <ChipGroup
            options={SWAP_REASONS.map((r) => ({ value: r, label: t(`session.swap.reasons.${r}`) }))}
            value={reason}
            onChange={setReason}
            accessibilityLabel={t('session.swap.reason')}
          />
          <TextField
            label={t('session.swap.note')}
            placeholder={t('session.swap.notePlaceholder')}
            value={note}
            onChangeText={setNote}
            maxLength={300}
          />
          {swap.isError ? <Notice tone="danger">{errorMessage(swap.error)}</Notice> : null}
          {swap.isPending ? <Text variant="caption">{t('session.swap.loading')}</Text> : null}
          <Button
            label={t('session.swap.submit')}
            disabled={!reason || !exercise.workoutExerciseId}
            loading={swap.isPending}
            onPress={() => reason && swap.mutate({ exerciseIndex, exercise, reason, note })}
          />
          {!exercise.workoutExerciseId ? (
            <Text variant="caption">{t('session.swap.unavailable')}</Text>
          ) : null}
        </>
      )}
    </Sheet>
  );
}
