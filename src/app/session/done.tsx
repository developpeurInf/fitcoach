import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, ChipGroup, Notice, Screen, Text, TextField } from '@/components/ui';
import { useUserId } from '@/features/auth/store';
import { SessionReportCard } from '@/features/coach/SessionReportCard';
import { type FinishResult, markRecordsCelebrated, useFinishSession } from '@/features/session/api';
import { summarize } from '@/features/session/logic';
import { useSession } from '@/features/session/store';
import { displayWeight, formatWeight } from '@/lib/units';
import { useSettings } from '@/stores/settings';
import { colors } from '@/theme/tokens';

const SCALE = [1, 2, 3, 4, 5] as const;

/** End of session: feeling, energy, comment, summary; then the records beaten. */
export default function SessionDoneScreen() {
  const { t } = useTranslation();
  const userId = useUserId();
  const active = useSession((s) => (s.active?.userId === userId ? s.active : null));
  const clear = useSession((s) => s.clear);
  const finish = useFinishSession();
  const [feeling, setFeeling] = useState<number>();
  const [energy, setEnergy] = useState<number>();
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinishResult | null>(null);
  // Frozen when the screen opens, so the duration doesn't keep growing while typing.
  const [openedAt] = useState(() => new Date());
  const summary = useMemo(
    () => (active ? summarize(active.exercises, active.startedAt, openedAt) : null),
    [active, openedAt],
  );

  if (result) return <Records result={result} />;
  if (!active || !summary) return <Redirect href="/" />;

  const save = () => {
    if (summary.setsDone === 0) return setError(t('session.done.noSets'));
    if (!feeling || !energy) return setError(t('session.done.required'));
    setError(null);
    finish.mutate(
      { session: active, feedback: { feeling, energy, comment } },
      {
        onSuccess: (r) => {
          setResult(r);
          clear();
        },
        onError: () => setError(t('session.done.error')),
      },
    );
  };

  return (
    <Screen title={t('session.done.title')}>
      <View className="gap-6">
        <Summary summary={summary} pains={active.pains.length} />

        <View className="gap-2">
          <Text variant="heading">{t('session.done.feeling')}</Text>
          <ChipGroup
            options={SCALE.map((v) => ({
              value: v,
              label: `${v} · ${t(`session.done.feelingLabels.${v}`)}`,
            }))}
            value={feeling}
            onChange={(v) => (setFeeling(v), setError(null))}
            accessibilityLabel={t('session.done.feeling')}
          />
        </View>
        <View className="gap-2">
          <Text variant="heading">{t('session.done.energy')}</Text>
          <ChipGroup
            options={SCALE.map((v) => ({
              value: v,
              label: `${v} · ${t(`session.done.energyLabels.${v}`)}`,
            }))}
            value={energy}
            onChange={(v) => (setEnergy(v), setError(null))}
            accessibilityLabel={t('session.done.energy')}
          />
        </View>
        <TextField
          label={t('session.done.comment')}
          placeholder={t('session.done.commentPlaceholder')}
          value={comment}
          onChangeText={setComment}
          multiline
          maxLength={2000}
        />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button label={t('session.done.save')} loading={finish.isPending} onPress={save} />
        <Button variant="secondary" label={t('session.keepGoing')} onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

function Summary({ summary, pains }: { summary: ReturnType<typeof summarize>; pains: number }) {
  const { t, i18n } = useTranslation();
  const unit = useSettings((s) => s.unit);
  const stats = [
    { label: t('session.done.duration'), value: `${summary.durationMinutes} min` },
    { label: t('session.done.sets'), value: String(summary.setsDone) },
    { label: t('session.done.reps'), value: String(summary.totalReps) },
    {
      label: t('session.done.volume'),
      value: `${Math.round(displayWeight(summary.volumeKg, unit)).toLocaleString(i18n.language)} ${unit}`,
    },
  ];
  return (
    <View className="gap-3">
      <Text variant="heading">{t('session.done.summary')}</Text>
      <View className="flex-row flex-wrap gap-3">
        {stats.map((s) => (
          <View
            key={s.label}
            className="min-w-[45%] flex-1 gap-1 rounded-2xl bg-white p-4 dark:bg-ink-900"
          >
            <Text variant="caption">{s.label}</Text>
            <Text variant="heading">{s.value}</Text>
          </View>
        ))}
      </View>
      {pains > 0 ? <Notice tone="warning">{`${t('session.done.pains')} : ${pains}`}</Notice> : null}
    </View>
  );
}

function Records({ result }: { result: FinishResult }) {
  const { t, i18n } = useTranslation();
  const unit = useSettings((s) => s.unit);

  useEffect(() => {
    void markRecordsCelebrated(result.records.map((r) => r.id));
  }, [result]);

  const format = (r: FinishResult['records'][number]) =>
    r.record_type === 'max_reps'
      ? `${r.value} reps`
      : r.record_type === 'estimated_1rm'
        ? formatWeight(r.value, unit, i18n.language)
        : `${formatWeight(r.value, unit, i18n.language)}${r.reps ? ` × ${r.reps}` : ''}`;

  return (
    <Screen title={t('session.done.title')}>
      <View className="gap-5">
        <Text variant="heading">{t('session.done.records')}</Text>
        {result.records.length === 0 ? (
          <Text>{t('session.done.noRecords')}</Text>
        ) : (
          result.records.map((r) => (
            <View
              key={r.id}
              className="flex-row items-center gap-3 rounded-2xl border border-accent bg-white p-4 dark:bg-ink-900"
            >
              <Ionicons name="trophy" size={28} color={colors.accent.DEFAULT} />
              <View className="flex-1">
                <Text className="font-bold">
                  {(i18n.language.startsWith('fr')
                    ? result.names[r.exercise_id]?.fr
                    : result.names[r.exercise_id]?.en) ?? r.exercise_id}
                </Text>
                <Text variant="caption">
                  {t(`session.recordTypes.${r.record_type}`)} · {format(r)}
                </Text>
              </View>
            </View>
          ))
        )}
        <SessionReportCard logId={result.log_id} />
        <Button label={t('session.done.home')} onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
