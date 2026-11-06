import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { EmptyState, Screen, Text } from '@/components/ui';
import { useProfile } from '@/features/profile/api';
import { colors } from '@/theme/tokens';

// The program and today's session arrive in phase 4.
export default function TodayScreen() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  return (
    <Screen>
      <View className="mb-6 mt-4 flex-row items-center justify-between">
        <View>
          <Text variant="title">{t('today.title')}</Text>
          {profile?.first_name ? (
            <Text variant="caption">{t('today.hello', { name: profile.first_name })}</Text>
          ) : null}
        </View>
        <Link href="/settings" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.title')}
            className="h-12 w-12 items-center justify-center"
          >
            <Ionicons name="settings-outline" size={24} color={colors.ink[500]} />
          </Pressable>
        </Link>
      </View>
      <EmptyState icon="flash" title={t('today.emptyTitle')} body={t('today.emptyBody')} />
    </Screen>
  );
}
