import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

import type { ExerciseListItem } from './api';
import { useLabels } from './labels';

export function ExerciseRow({ exercise }: { exercise: ExerciseListItem }) {
  const { t } = useTranslation();
  const { muscle, equipment } = useLabels();
  const thumb = exercise.gif_url ?? exercise.image_urls[0];
  const meta = [
    exercise.primary_muscles.slice(0, 2).map(muscle).join(', '),
    exercise.equipment.slice(0, 2).map(equipment).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint={meta}
      onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })}
      className="min-h-20 flex-row items-center gap-3 rounded-2xl bg-white p-3 active:opacity-70 dark:bg-ink-900"
    >
      <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-ink-100 dark:bg-ink-800">
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            className="h-full w-full"
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Ionicons name="barbell" size={28} color={colors.ink[500]} />
        )}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-bold" numberOfLines={2}>
          {exercise.name_fr}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {meta}
        </Text>
        <Text variant="caption">{t(`exercises.levels.${exercise.level}`)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.ink[500]} />
    </Pressable>
  );
}
