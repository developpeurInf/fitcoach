import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Image, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

/**
 * GIF when the library has one; otherwise the start and end photos alternate like a short
 * animation (still when the system asks to reduce motion).
 */
export function ExerciseFrames({
  gif,
  images,
  name,
}: {
  gif: string | null;
  images: string[];
  name: string;
}) {
  const { t } = useTranslation();
  const [frame, setFrame] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const frames = gif ? [gif] : images.slice(0, 2);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);
  useEffect(() => {
    if (frames.length < 2 || reduceMotion) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % 2), 1000);
    return () => clearInterval(id);
  }, [frames.length, reduceMotion]);

  return (
    <View className="gap-1">
      <View className="aspect-[4/3] w-full overflow-hidden rounded-3xl bg-white">
        {frames.length ? (
          frames.map((uri, i) => (
            <Image
              key={uri}
              source={{ uri }}
              className="absolute h-full w-full"
              style={{ opacity: i === frame ? 1 : 0 }}
              resizeMode="contain"
              accessibilityLabel={i === 0 ? name : undefined}
              accessibilityIgnoresInvertColors
            />
          ))
        ) : (
          <View className="flex-1 items-center justify-center gap-2 bg-ink-100 dark:bg-ink-900">
            <Ionicons name="barbell" size={56} color={colors.ink[500]} />
            <Text variant="caption">{t('exercises.sheet.noMedia')}</Text>
          </View>
        )}
      </View>
      {frames.length === 2 ? <Text variant="caption">{t('exercises.sheet.frames')}</Text> : null}
    </View>
  );
}
