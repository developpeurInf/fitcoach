import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';

import { Notice, Screen, Text } from '@/components/ui';
import { useExercise, useExerciseNames, useExerciseSheet } from '@/features/exercises/api';
import { ExerciseFrames } from '@/features/exercises/ExerciseFrames';
import { useLabels } from '@/features/exercises/labels';
import { BackHeader } from '@/features/progress/BackHeader';
import { colors } from '@/theme/tokens';

/** Exercise sheet (§7): media, muscles, equipment, steps, mistakes, breathing, variants. */
export default function ExerciseScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useExercise(id);
  const sheet = useExerciseSheet(query.data);
  const ex = sheet.data ? { ...query.data!, ...sheet.data } : query.data;
  const names = useExerciseNames([ex?.easier_variant_id ?? null, ex?.harder_variant_id ?? null]);
  const { muscle, equipment } = useLabels();

  if (query.isPending) {
    return (
      <Screen>
        <BackHeader title="" fallback="/exercises" />
        <ActivityIndicator color={colors.accent.DEFAULT} />
      </Screen>
    );
  }
  if (!ex) {
    return (
      <Screen>
        <BackHeader title={t('exercises.title')} fallback="/exercises" />
        <Notice tone="danger">{t('common.error')}</Notice>
      </Screen>
    );
  }

  const hasSheet = ex.instructions_fr.length > 0;
  return (
    <Screen>
      <BackHeader title={ex.name_fr} fallback="/exercises" />
      <View className="gap-5">
        <ExerciseFrames gif={ex.gif_url} images={ex.image_urls} name={ex.name_fr} />
        <View className="flex-row flex-wrap gap-2">
          <Tag label={t(`exercises.levels.${ex.level}`)} />
          {ex.equipment.map((e) => (
            <Tag key={e} label={equipment(e)} />
          ))}
        </View>
        <Section title={t('exercises.sheet.primary')}>
          <Text>{ex.primary_muscles.map(muscle).join(', ')}</Text>
          {ex.secondary_muscles.length ? (
            <Text variant="caption">
              {t('exercises.sheet.secondary')} : {ex.secondary_muscles.map(muscle).join(', ')}
            </Text>
          ) : null}
        </Section>

        {sheet.isFetching && !hasSheet ? (
          <View className="flex-row items-center gap-3">
            <ActivityIndicator color={colors.ink[500]} />
            <Text variant="caption">{t('exercises.sheet.loading')}</Text>
          </View>
        ) : null}

        {hasSheet ? (
          <>
            <Section title={t('exercises.sheet.steps')}>
              {ex.instructions_fr.map((s, i) => (
                <Text key={i}>
                  {i + 1}. {s}
                </Text>
              ))}
            </Section>
            <Section title={t('exercises.sheet.mistakes')}>
              {ex.common_mistakes_fr.map((s, i) => (
                <Text key={i}>• {s}</Text>
              ))}
            </Section>
            {ex.breathing_tip_fr ? (
              <Notice tone="info" title={t('exercises.sheet.breathing')}>
                {ex.breathing_tip_fr}
              </Notice>
            ) : null}
          </>
        ) : sheet.isError || (!sheet.isFetching && ex.instructions_en.length) ? (
          <>
            {sheet.isError ? <Notice tone="warning">{t('exercises.sheet.error')}</Notice> : null}
            <Section title={t('exercises.sheet.sourceSteps')}>
              {ex.instructions_en.map((s, i) => (
                <Text key={i}>
                  {i + 1}. {s}
                </Text>
              ))}
            </Section>
          </>
        ) : null}

        {ex.easier_variant_id || ex.harder_variant_id ? (
          <Section title={t('exercises.sheet.variants')}>
            {(
              [
                ['easier', ex.easier_variant_id],
                ['harder', ex.harder_variant_id],
              ] as const
            ).map(([kind, vid]) =>
              vid ? (
                <Pressable
                  key={kind}
                  accessibilityRole="link"
                  onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: vid } })}
                  className="min-h-14 flex-row items-center gap-3 rounded-2xl bg-white p-3 active:opacity-70 dark:bg-ink-900"
                >
                  <Ionicons
                    name={kind === 'easier' ? 'arrow-down-circle' : 'arrow-up-circle'}
                    size={24}
                    color={colors.ink[500]}
                  />
                  <View className="flex-1">
                    <Text variant="caption">{t(`exercises.sheet.${kind}`)}</Text>
                    <Text className="font-bold">{names.data?.[vid] ?? vid}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.ink[500]} />
                </Pressable>
              ) : null,
            )}
          </Section>
        ) : null}

        {ex.youtube_video_id ? (
          <Pressable
            onPress={() =>
              void Linking.openURL(`https://www.youtube.com/watch?v=${ex.youtube_video_id}`)
            }
            accessibilityRole="link"
            className="min-h-12 flex-row items-center gap-2 self-start"
          >
            <Ionicons name="logo-youtube" size={22} color={colors.danger} />
            <Text className="font-semibold">{t('session.video')}</Text>
          </Pressable>
        ) : null}
        {ex.source === 'free-exercise-db' ? (
          <Text variant="caption">{t('exercises.sheet.credit')}</Text>
        ) : null}
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text variant="heading">{title}</Text>
      {children}
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-ink-100 px-3 py-1.5 dark:bg-ink-800">
      <Text variant="caption" className="font-semibold">
        {label}
      </Text>
    </View>
  );
}
