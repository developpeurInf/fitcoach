import '../../global.css';
import '@/i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { startAuthListener, useAuth } from '@/features/auth/store';
import { useProfile } from '@/features/profile/api';
import { queryClient } from '@/lib/query-client';
import { useThemeSync } from '@/theme/useThemeSync';

void SplashScreen.preventAutoHideAsync();
startAuthListener();

export default function RootLayout() {
  const scheme = useThemeSync();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Three mutually exclusive areas, chosen from auth + profile state:
 * signed out → (auth); signed in without onboarding → onboarding; otherwise → the app.
 * Stack.Protected redirects automatically when the guards change (sign-in, onboarding done, sign-out).
 */
function RootNavigator() {
  const { session, ready } = useAuth();
  const profile = useProfile();
  const signedIn = !!session;
  const loading = !ready || (signedIn && profile.isPending);
  const onboarded = !!profile.data?.onboarding_completed_at;

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null; // splash screen stays visible

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}
