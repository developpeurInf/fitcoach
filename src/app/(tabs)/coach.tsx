import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Segmented, Text } from '@/components/ui';
import { ChatView } from '@/features/coach/ChatView';
import { ReportsList } from '@/features/coach/ReportsList';

type Tab = 'chat' | 'reports';

export default function CoachScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('chat');
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50 dark:bg-ink-950">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View className="flex-1 gap-4 px-5 pb-4">
          <Text variant="title" className="mt-4">
            {t('coach.title')}
          </Text>
          <Segmented
            options={[
              { value: 'chat', label: t('coach.tabs.chat') },
              { value: 'reports', label: t('coach.tabs.reports') },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'chat' ? <ChatView /> : <ReportsList />}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
