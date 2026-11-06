import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from './Text';

type Props = { title?: string; children: ReactNode; scroll?: boolean };

/** Base screen: safe area, themed background, optional large title. */
export function Screen({ title, children, scroll = true }: Props) {
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50 dark:bg-ink-950">
      <Body className="flex-1" contentContainerClassName="px-5 pb-10 grow">
        {title ? (
          <Text variant="title" className="mb-6 mt-4">
            {title}
          </Text>
        ) : null}
        {children}
      </Body>
    </SafeAreaView>
  );
}
