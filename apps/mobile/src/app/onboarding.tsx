import { useRouter } from 'expo-router';
import { GitCompareArrows, MapPin, Search, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '@/components/ui';
import { LogoMark } from '@/components/ui/Logo';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius, spacing } from '@/theme/tokens';

const SLIDES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Search, title: 'onboarding.s1Title', body: 'onboarding.s1Body' },
  { icon: GitCompareArrows, title: 'onboarding.s2Title', body: 'onboarding.s2Body' },
  { icon: MapPin, title: 'onboarding.s3Title', body: 'onboarding.s3Body' },
];

export default function Onboarding() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const set = usePreferences((s) => s.set);
  const [index, setIndex] = useState(0);
  const [disclaimer, setDisclaimer] = useState(false);
  const list = useRef<FlatList>(null);

  const finish = () => {
    set({ onboardingDone: true, disclaimerAccepted: true });
    router.replace('/');
  };

  if (disclaimer) {
    return (
      <Animated.View entering={FadeIn.duration(250)} style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + spacing.huge, paddingHorizontal: spacing.xxl, paddingBottom: insets.bottom + spacing.xl, justifyContent: 'space-between' }}>
        <View style={{ gap: spacing.lg }}>
          <View style={{ width: 64, height: 64, borderRadius: radius.xl, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={30} color={colors.primary} />
          </View>
          <Text variant="h1">{t('onboarding.disclaimerTitle')}</Text>
          <Text variant="body" color="textSecondary" style={{ fontSize: 16, lineHeight: 25 }}>
            {t('onboarding.disclaimerBody')}
          </Text>
        </View>
        <Button testID="accept-disclaimer" label={t('onboarding.accept')} onPress={finish} full />
      </Animated.View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.forest800 }}>
      <View style={{ paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xxl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <LogoMark size={34} inverted />
          <Text style={{ color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 20, letterSpacing: -0.5 }}>MedDexa</Text>
        </View>
        <Button label={t('onboarding.skip')} variant="onDark" size="sm" onPress={() => setDisclaimer(true)} />
      </View>
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.title}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: spacing.xxl, justifyContent: 'center', gap: spacing.xl }}>
            <View style={{ width: 88, height: 88, borderRadius: radius.xxl, backgroundColor: 'rgba(127,224,181,0.16)', alignItems: 'center', justifyContent: 'center' }}>
              <item.icon size={40} color={palette.mint400} strokeWidth={1.8} />
            </View>
            <Text style={{ color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 34, lineHeight: 40, letterSpacing: -1 }}>{t(item.title)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.78)', fontFamily: 'Manrope_500Medium', fontSize: 17, lineHeight: 26 }}>{t(item.body)}</Text>
          </View>
        )}
      />
      <View style={{ paddingHorizontal: spacing.xxl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`${index + 1} / ${SLIDES.length}`}>
          {SLIDES.map((_, i) => (
            <View key={i} style={{ height: 6, width: i === index ? 26 : 6, borderRadius: 3, backgroundColor: i === index ? palette.mint400 : 'rgba(255,255,255,0.3)' }} />
          ))}
        </View>
        <Button
          testID="onboarding-next"
          label={index === SLIDES.length - 1 ? t('onboarding.start') : t('onboarding.next')}
          onPress={() => {
            if (index < SLIDES.length - 1) {
              list.current?.scrollToIndex({ index: index + 1 });
              setIndex(index + 1);
            } else setDisclaimer(true);
          }}
          variant="mint"
          full
        />
      </View>
    </View>
  );
}
