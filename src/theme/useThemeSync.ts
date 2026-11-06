import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';

import { useSettings } from '@/stores/settings';

/** Applies the stored theme preference to NativeWind (dark: classes). */
export function useThemeSync() {
  const theme = useSettings((s) => s.theme);
  const { colorScheme, setColorScheme } = useColorScheme();
  useEffect(() => {
    setColorScheme(theme);
  }, [theme, setColorScheme]);
  return colorScheme ?? 'dark';
}
