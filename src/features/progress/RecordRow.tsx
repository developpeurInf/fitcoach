import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { localDate } from '@/features/program/api';
import { addDays, formatDayLong } from '@/lib/dates';
import { formatWeight } from '@/lib/units';
import { useSettings } from '@/stores/settings';
import { colors } from '@/theme/tokens';

type Record = {
  exercise_id: string;
  record_type: string;
  value: number;
  reps: number | null;
  achieved_on: string;
  exercise: { name_fr: string; name_en: string } | null;
};

const NEW_DAYS = 7;

/** One personal record: exercise, type, value, date; "Nouveau" for the last 7 days. */
export function RecordRow({ record: r }: { record: Record }) {
  const { t, i18n } = useTranslation();
  const unit = useSettings((s) => s.unit);
  const name =
    (i18n.language.startsWith('fr') ? r.exercise?.name_fr : r.exercise?.name_en) ?? r.exercise_id;
  const value =
    r.record_type === 'max_reps'
      ? `${r.value} reps`
      : `${formatWeight(Number(r.value), unit, i18n.language)}${
          r.record_type === 'max_load' && r.reps ? ` × ${r.reps}` : ''
        }`;
  // Calendar days compared as strings: a record of the last 7 days is "new".
  const isNew = r.achieved_on > addDays(localDate(), -NEW_DAYS);

  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-white p-4 dark:bg-ink-900">
      <Ionicons name="trophy" size={24} color={colors.warning} />
      <View className="flex-1 gap-0.5">
        <Text className="font-bold">{name}</Text>
        <Text variant="caption">
          {t(`session.recordTypes.${r.record_type as 'max_load'}`)} · {value}
        </Text>
        <Text variant="caption">{formatDayLong(r.achieved_on)}</Text>
      </View>
      {isNew ? (
        <View className="rounded-full bg-accent px-3 py-1">
          <Text variant="caption" className="font-bold" style={{ color: colors.accent.foreground }}>
            {t('progress.records.new')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
