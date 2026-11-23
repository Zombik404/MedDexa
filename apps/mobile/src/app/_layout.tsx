import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { ToastProvider } from '@/components/ui/Toast';
import { useHydrated } from '@/hooks/useHydrated';
import i18n, { resolveLanguage } from '@/i18n';
import { usePreferences } from '@/store/preferences';
import { useSession } from '@/store/session';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, sendDefaultPii: false, tracesSampleRate: 0.1 });
}

// Refetch when the app returns to the foreground.
AppState.addEventListener('change', (s) => {
  if (Platform.OS !== 'web') focusManager.setFocused(s === 'active');
});
onlineManager.setOnline(true);

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
        refetchOnWindowFocus: false,
      },
    },
  });
}

function Navigator() {
  const { colors, dark } = useTheme();
  const { t } = useTranslation();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17 },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="medicine/[id]" options={{ title: '' }} />
        <Stack.Screen name="pharmacy/[id]" options={{ title: '' }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="photo" options={{ presentation: 'modal', title: t('photo.title') }} />
        <Stack.Screen name="review/new" options={{ presentation: 'modal', title: t('reviews.write') }} />
        <Stack.Screen name="auth/login" options={{ presentation: 'modal', title: '' }} />
        <Stack.Screen name="auth/register" options={{ presentation: 'modal', title: '' }} />
        <Stack.Screen name="auth/forgot" options={{ presentation: 'modal', title: '' }} />
        <Stack.Screen name="profile/favorites" options={{ title: t('profile.favorites') }} />
        <Stack.Screen name="profile/history" options={{ title: t('profile.comparisons') }} />
        <Stack.Screen name="profile/recent" options={{ title: t('profile.recent') }} />
        <Stack.Screen name="profile/settings" options={{ title: t('profile.settings') }} />
        <Stack.Screen name="profile/privacy" options={{ title: t('profile.privacy') }} />
        <Stack.Screen name="profile/account" options={{ title: t('profile.account') }} />
        <Stack.Screen name="profile/about" options={{ title: t('profile.about') }} />
      </Stack>
    </>
  );
}

function RootLayout() {
  const [client] = useState(makeClient);
  const [fontsLoaded] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  const hydrated = useHydrated();
  const sessionReady = useSession((s) => s.ready);
  const language = usePreferences((s) => s.language);

  useEffect(() => {
    void useSession.getState().hydrate();
  }, []);

  useEffect(() => {
    if (hydrated) void i18n.changeLanguage(resolveLanguage(language));
  }, [hydrated, language]);

  const ready = fontsLoaded && hydrated && sessionReady;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <ThemeProvider>
            <ToastProvider>
              <Navigator />
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default process.env.EXPO_PUBLIC_SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;
