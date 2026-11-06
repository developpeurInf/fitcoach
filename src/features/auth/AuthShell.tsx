import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Screen, Text } from '@/components/ui';

/** Shared frame for auth screens: brand, title, centered column (max width on web). */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="w-full max-w-md flex-1 justify-center gap-6 self-center py-8">
          <View className="gap-2">
            <Text variant="title" className="text-accent-muted dark:text-accent">
              FitCoach
            </Text>
            <Text variant="heading">{title}</Text>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
