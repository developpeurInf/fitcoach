import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from './env';
import { authStorage } from './storage';
import type { Database } from '@/types/database';

export const supabase = createClient<Database>(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      // PKCE: OAuth returns a one-time code exchanged for the session (works on web and native).
      flowType: 'pkce',
      // OAuth redirects (Google) land on the web URL; native handles them via deep links.
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);

// Refresh the token only while the app is in the foreground (recommended for React Native).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
