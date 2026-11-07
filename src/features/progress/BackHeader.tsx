import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

/** Back arrow + title for sub-screens. */
export function BackHeader({ title, fallback = '/progress' }: { title: string; fallback?: Href }) {
  const { t } = useTranslation();
  return (
    <View className="mb-4 mt-2 gap-1">
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
        accessibilityRole="button"
        accessibilityLabel={t('onboarding.back')}
        className="h-12 w-12 justify-center"
      >
        <Ionicons name="chevron-back" size={28} color={colors.ink[500]} />
      </Pressable>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}
