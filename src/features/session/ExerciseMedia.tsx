import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Image, Linking, Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

import type { SessionExercise } from './logic';

/**
 * GIF when the library has one, otherwise the first photo. The video link is shown only when the
 * library holds a real YouTube id: URLs are never made up.
 */
export function ExerciseMedia({ exercise, name }: { exercise: SessionExercise; name: string }) {
  const { t } = useTranslation();
  const uri = exercise.gifUrl ?? exercise.imageUrl;
  return (
    <View className="gap-2">
      <View className="aspect-[4/3] w-full overflow-hidden rounded-3xl bg-ink-100 dark:bg-ink-900">
        {uri ? (
          <Image
            source={{ uri }}
            className="h-full w-full"
            resizeMode="contain"
            accessibilityLabel={name}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="barbell" size={56} color={colors.ink[500]} />
          </View>
        )}
      </View>
      {exercise.youtubeVideoId ? (
        <Pressable
          onPress={() =>
            void Linking.openURL(`https://www.youtube.com/watch?v=${exercise.youtubeVideoId}`)
          }
          accessibilityRole="link"
          className="min-h-12 flex-row items-center gap-2 self-start"
        >
          <Ionicons name="logo-youtube" size={22} color={colors.danger} />
          <Text className="font-semibold">{t('session.video')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
