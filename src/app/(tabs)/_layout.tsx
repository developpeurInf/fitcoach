import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme !== 'light';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: dark ? colors.accent.DEFAULT : colors.ink[950],
        tabBarInactiveTintColor: colors.ink[500],
        tabBarStyle: {
          backgroundColor: dark ? colors.ink[900] : '#FFFFFF',
          borderTopColor: dark ? colors.ink[800] : colors.ink[100],
          height: 64,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.today'), tabBarIcon: icon('flash') }} />
      <Tabs.Screen
        name="program"
        options={{ title: t('tabs.program'), tabBarIcon: icon('calendar') }}
      />
      <Tabs.Screen
        name="exercises"
        options={{ title: t('tabs.exercises'), tabBarIcon: icon('barbell') }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: t('tabs.progress'), tabBarIcon: icon('trending-up') }}
      />
      <Tabs.Screen
        name="coach"
        options={{ title: t('tabs.coach'), tabBarIcon: icon('chatbubbles') }}
      />
    </Tabs>
  );
}
