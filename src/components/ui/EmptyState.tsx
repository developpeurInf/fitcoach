import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { colors } from '@/theme/tokens';

import { Button } from './Button';
import { Text } from './Text';

type Props = {
  icon?: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = 'sparkles', title, body, actionLabel, onAction }: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-3 py-16">
      <View className="mb-2 h-16 w-16 items-center justify-center rounded-full bg-accent/15">
        <Ionicons name={icon} size={28} color={colors.accent.DEFAULT} />
      </View>
      <Text variant="heading" className="text-center">
        {title}
      </Text>
      {body ? (
        <Text variant="caption" className="max-w-72 text-center">
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-4 w-full max-w-72">
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
