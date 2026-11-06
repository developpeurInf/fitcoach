import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

// Minimal settings for now (sign-out). Profile, units, theme, export and deletion come in phase 8.
export default function SettingsScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('settings.title')}>
      <View className="gap-3">
        <Button
          variant="secondary"
          label={t('auth.signOut')}
          onPress={async () => {
            await supabase.auth.signOut();
            queryClient.clear();
          }}
        />
        <Button variant="secondary" label={t('common.close')} onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
