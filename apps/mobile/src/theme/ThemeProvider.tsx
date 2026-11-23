import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { usePreferences } from '@/store/preferences';
import { darkColors, lightColors, type ThemeColors } from './tokens';

interface ThemeValue {
  colors: ThemeColors;
  dark: boolean;
}

const ThemeContext = createContext<ThemeValue>({ colors: lightColors, dark: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const preference = usePreferences((s) => s.theme);
  const dark = preference === 'system' ? system === 'dark' : preference === 'dark';
  const value = useMemo(() => ({ colors: dark ? darkColors : lightColors, dark }), [dark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
