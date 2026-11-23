import { Redirect, Tabs } from 'expo-router';
import { GitCompareArrows, House, MapPin, Search, UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { Text } from '@/components/ui';
import { useCompare } from '@/store/compare';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, palette, shadow } from '@/theme/tokens';

function CompareIcon({ focused }: { focused: boolean }) {
  const { colors } = useTheme();
  const count = useCompare((s) => s.items.length);
  return (
    <View style={{ marginTop: Platform.OS === 'ios' ? -14 : -18 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: focused ? colors.primary : palette.forest800,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 4,
          borderColor: colors.background,
          ...shadow(colors, 2),
        }}
      >
        <GitCompareArrows size={24} color={focused && colors.primary !== palette.forest800 ? palette.forest900 : '#FFFFFF'} strokeWidth={2.2} />
      </View>
      {count > 0 ? (
        <View style={{ position: 'absolute', top: -2, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: palette.mint400, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text variant="caption" style={{ color: palette.forest900, letterSpacing: 0 }}>
            {count}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const onboardingDone = usePreferences((s) => s.onboardingDone);
  if (!onboardingDone) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border, height: Platform.OS === 'ios' ? 88 : 68, paddingTop: 6 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: ({ color }) => <House size={22} color={color} strokeWidth={2} />, tabBarButtonTestID: 'tab-home' }} />
      <Tabs.Screen name="search" options={{ title: t('tabs.search'), tabBarIcon: ({ color }) => <Search size={22} color={color} strokeWidth={2} />, tabBarButtonTestID: 'tab-search' }} />
      <Tabs.Screen
        name="compare"
        options={{ title: t('tabs.compare'), tabBarIcon: ({ focused }) => <CompareIcon focused={focused} />, tabBarButtonTestID: 'tab-compare', tabBarAccessibilityLabel: t('tabs.compare') }}
      />
      <Tabs.Screen name="pharmacies" options={{ title: t('tabs.pharmacies'), tabBarIcon: ({ color }) => <MapPin size={22} color={color} strokeWidth={2} />, tabBarButtonTestID: 'tab-pharmacies' }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: ({ color }) => <UserRound size={22} color={color} strokeWidth={2} />, tabBarButtonTestID: 'tab-profile' }} />
    </Tabs>
  );
}
