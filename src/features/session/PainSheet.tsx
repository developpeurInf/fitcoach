import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, ChipGroup, Notice, Sheet, Text, TextField } from '@/components/ui';
import { INJURIES } from '@/features/onboarding/schema';

import { SEVERE_PAIN, type SessionExercise } from './logic';
import { useSession } from './store';

const ZONES = [...INJURIES, 'other'] as const;
const INTENSITIES = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));

type Props = {
  visible: boolean;
  onClose: () => void;
  exercise: SessionExercise;
  onReplace: () => void;
  onStop: () => void;
};

/**
 * Pain report, stored with the session (workout_logs.pains) for the coach. Applies the safety
 * rule of the coach context (§2): sharp pain → stop, and see a professional if needed.
 */
export function PainSheet({ visible, onClose, exercise, onReplace, onStop }: Props) {
  const { t } = useTranslation();
  const reportPain = useSession((s) => s.reportPain);
  const [zone, setZone] = useState<(typeof ZONES)[number]>();
  const [intensity, setIntensity] = useState<number>();
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<number | null>(null);

  const close = () => {
    setZone(undefined);
    setIntensity(undefined);
    setNote('');
    setSaved(null);
    onClose();
  };

  if (saved !== null) {
    const severe = saved >= SEVERE_PAIN;
    return (
      <Sheet visible={visible} title={t('session.pain.title')} onClose={close}>
        <Notice tone="info">{t('session.pain.saved')}</Notice>
        <Notice tone={severe ? 'danger' : 'warning'}>
          {severe ? t('session.pain.severe') : t('session.pain.mild')}
        </Notice>
        <View className="gap-3">
          <Button label={t('session.pain.replace')} onPress={() => (close(), onReplace())} />
          <Button
            label={severe ? t('session.pain.stop') : t('session.keepGoing')}
            variant="secondary"
            onPress={() => (close(), severe ? onStop() : undefined)}
          />
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} title={t('session.pain.title')} onClose={close}>
      <Text variant="caption" className="font-semibold uppercase tracking-wide">
        {t('session.pain.zone')}
      </Text>
      <ChipGroup
        options={ZONES.map((z) => ({ value: z, label: t(`session.pain.zones.${z}`) }))}
        value={zone}
        onChange={setZone}
        accessibilityLabel={t('session.pain.zone')}
      />
      <Text variant="caption" className="font-semibold uppercase tracking-wide">
        {t('session.pain.intensity')}
      </Text>
      <ChipGroup
        options={INTENSITIES}
        value={intensity}
        onChange={setIntensity}
        accessibilityLabel={t('session.pain.intensity')}
      />
      <TextField
        label={t('session.pain.note')}
        value={note}
        onChangeText={setNote}
        maxLength={300}
      />
      <Button
        label={t('session.pain.submit')}
        disabled={!zone || !intensity}
        onPress={() => {
          if (!zone || !intensity) return;
          reportPain({
            exercise_id: exercise.exerciseId,
            zone,
            intensite: intensity,
            ...(note.trim() ? { note: note.trim() } : {}),
          });
          setSaved(intensity);
        }}
      />
    </Sheet>
  );
}
