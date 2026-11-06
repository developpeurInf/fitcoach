import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { useUserId } from '@/features/auth/store';
import { colors } from '@/theme/tokens';

import { useSession } from './store';

/** Shown on Today while a session is in progress, so it's one tap to get back to it. */
export function ActiveSessionBanner() {
  const { t } = useTranslation();
  const userId = useUserId();
  const active = useSession((s) => (s.active?.userId === userId ? s.active : null));
  if (!active) return null;
  return (
    <Pressable
      onPress={() => router.push('/session')}
      accessibilityRole="button"
      accessibilityLabel={`${t('session.inProgress')} : ${active.title}. ${t('session.resume')}`}
      className="min-h-16 flex-row items-center gap-3 rounded-2xl bg-accent px-4 py-3 active:opacity-80"
    >
      <Ionicons name="play-circle" size={32} color={colors.accent.foreground} />
      <View className="flex-1">
        <Text className="font-bold" style={{ color: colors.accent.foreground }}>
          {t('session.resume')}
        </Text>
        <Text variant="caption" style={{ color: colors.accent.foreground }}>
          {active.title}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.accent.foreground} />
    </Pressable>
  );
}
