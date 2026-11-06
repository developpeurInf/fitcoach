import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/tokens';

import { Text } from './Text';

type Props = { visible: boolean; title: string; onClose: () => void; children: ReactNode };

/** Bottom sheet for short tasks during a session (replace an exercise, report pain). */
export function Sheet({ visible, title, onClose, children }: Props) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/60"
      >
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('common.close')} />
        <SafeAreaView
          edges={['bottom']}
          className="max-h-[85%] rounded-t-3xl bg-ink-50 dark:bg-ink-950"
          accessibilityViewIsModal
        >
          <View className="flex-row items-center justify-between px-5 pt-4">
            <Text variant="heading" accessibilityRole="header">
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              className="h-12 w-12 items-center justify-center"
            >
              <Ionicons name="close" size={26} color={colors.ink[500]} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerClassName="gap-5 px-5 pb-6 pt-2"
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
