import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button, ChipGroup, Text } from '@/components/ui';
import { displayWeight, formatWeight, toKg } from '@/lib/units';
import { useSettings } from '@/stores/settings';
import { colors } from '@/theme/tokens';

import type { LoggedSet } from './logic';
import { NumberStepper } from './NumberStepper';

const RPE_OPTIONS = [6, 7, 8, 9, 10].map((v) => ({ value: v, label: String(v) }));

type Props = {
  set: LoggedSet;
  timed: boolean;
  active: boolean;
  onChange: (patch: Partial<LoggedSet>) => void;
  onComplete: () => void;
  onReopen: () => void;
};

/**
 * One set. The active (next) set is expanded with steppers pre-filled and a big "validate" button;
 * done sets collapse to one line (tap to edit), upcoming ones show their pre-filled values.
 */
export function SetRow({ set, timed, active, onChange, onComplete, onReopen }: Props) {
  const { t, i18n } = useTranslation();
  const unit = useSettings((s) => s.unit);
  const load = set.loadKg != null ? displayWeight(set.loadKg, unit) : null;
  const summary = [
    timed ? `${set.durationSec ?? 0} s` : `${set.reps ?? 0} reps`,
    set.loadKg ? formatWeight(set.loadKg, unit, i18n.language) : null,
    set.rpe != null ? `RPE ${set.rpe}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (!active) {
    return (
      <Pressable
        onPress={set.done ? onReopen : undefined}
        disabled={!set.done}
        accessibilityRole={set.done ? 'button' : undefined}
        accessibilityLabel={
          set.done
            ? `${t('session.validated', { n: set.setNumber })}, ${summary}. ${t('session.edit')}`
            : undefined
        }
        className="min-h-12 flex-row items-center gap-3 rounded-2xl bg-ink-100 px-4 py-2 dark:bg-ink-900"
      >
        <Ionicons
          name={set.done ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={set.done ? colors.success : colors.ink[500]}
        />
        <Text className="font-semibold">{t('session.set', { n: set.setNumber })}</Text>
        <Text variant="caption" className="flex-1 text-right">
          {summary}
        </Text>
        {set.done ? <Ionicons name="create-outline" size={18} color={colors.ink[500]} /> : null}
      </Pressable>
    );
  }

  return (
    <View className="gap-4 rounded-3xl border-2 border-accent bg-white p-4 dark:bg-ink-900">
      <Text variant="heading">{t('session.set', { n: set.setNumber })}</Text>
      <View className="flex-row gap-3">
        {timed ? (
          <NumberStepper
            label={t('session.duration')}
            value={set.durationSec}
            step={5}
            onChange={(durationSec) => onChange({ durationSec })}
          />
        ) : (
          <NumberStepper
            label={t('session.reps')}
            value={set.reps}
            step={1}
            onChange={(reps) => onChange({ reps })}
          />
        )}
        <NumberStepper
          label={t('session.load', { unit })}
          value={load}
          step={unit === 'kg' ? 2.5 : 5}
          decimals
          onChange={(v) =>
            onChange({ loadKg: v == null ? null : Math.round(toKg(v, unit) * 100) / 100 })
          }
        />
      </View>
      <View className="gap-2">
        <Text variant="caption" className="font-semibold">
          {t('session.rpe')}
        </Text>
        <ChipGroup
          options={RPE_OPTIONS}
          value={set.rpe ?? undefined}
          onChange={(rpe) => onChange({ rpe: set.rpe === rpe ? null : rpe })}
          accessibilityLabel={t('session.rpe')}
        />
      </View>
      <Button label={t('session.validate', { n: set.setNumber })} onPress={onComplete} />
    </View>
  );
}
