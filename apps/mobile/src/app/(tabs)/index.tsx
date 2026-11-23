import { useRouter } from 'expo-router';
import { ArrowRight, Clock3, Heart, History, LocateFixed, MapPin, Navigation, ShieldCheck, Tags } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { useCategories, useFavorites, usePharmacySearch, usePopularMedicines, usePopularSearches, useRecentlyViewed, useSignedIn } from '@/api/hooks';
import { MedicineCard } from '@/components/medicine/MedicineCard';
import { PharmacyCard } from '@/components/pharmacy/PharmacyCard';
import { Screen } from '@/components/Screen';
import { Card, Chip, ErrorState, SearchBar, Section, Skeleton, Text, Wordmark } from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { useCompare } from '@/store/compare';
import { useLocal } from '@/store/local';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius, spacing } from '@/theme/tokens';

function greetingKey() {
  const h = new Date().getHours();
  return h < 12 ? 'home.morning' : h < 18 ? 'home.afternoon' : 'home.evening';
}

function Shortcut({ icon: Icon, label, onPress, testID }: { icon: typeof Clock3; label: string; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: spacing.sm, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 54, height: 54, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={22} color={colors.primary} strokeWidth={2} />
      </View>
      <Text variant="small" align="center" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const signedIn = useSignedIn();
  const location = useLocation(true);
  const compareCount = useCompare((s) => s.items.length);
  const local = useLocal();

  const nearby = usePharmacySearch(
    { lat: location.coords?.lat, lng: location.coords?.lng, radiusKm: 10, sort: 'distance' },
    location.status === 'granted' && !!location.coords,
  );
  const popular = usePopularMedicines();
  const popularSearches = usePopularSearches();
  const categories = useCategories();
  const remoteRecent = useRecentlyViewed();
  const remoteFavs = useFavorites();

  const recentMedicines = signedIn ? (remoteRecent.data?.medicines ?? []).map((m) => ({ id: m.id, name: m.name })) : local.recentMedicines;
  const recentPharmacies = signedIn ? (remoteRecent.data?.pharmacies ?? []).map((p) => ({ id: p.id, name: p.name })) : local.recentPharmacies;
  const favoriteMeds = signedIn
    ? (remoteFavs.data ?? []).filter((f) => f.medicine).map((f) => ({ id: f.medicine!.id, name: f.medicine!.name }))
    : local.favoriteMedicines;

  const firstName = user?.displayName?.split(' ')[0];
  const nearbyItems = nearby.data?.pages[0]?.items ?? [];

  return (
    <Screen
      refreshing={popular.isRefetching}
      onRefresh={() => {
        void popular.refetch();
        void nearby.refetch();
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl }}>
        <Wordmark size={20} />
        <Pressable
          testID="location-indicator"
          accessibilityRole="button"
          onPress={() => (location.status === 'granted' ? router.push('/pharmacies') : location.request())}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          {location.status === 'granted' ? <Navigation size={14} color={colors.primary} fill={colors.primary} /> : <LocateFixed size={14} color={colors.textSecondary} />}
          <Text variant="small" color={location.status === 'granted' ? 'text' : 'textSecondary'} numberOfLines={1} style={{ maxWidth: 140 }}>
            {location.status === 'granted' ? location.city ?? t('pharmacies.nearMe') : location.status === 'locating' ? t('home.locating') : t('home.locationOff')}
          </Text>
        </Pressable>
      </View>

      <Text variant="display" style={{ marginBottom: spacing.lg }} accessibilityRole="header">
        {t(greetingKey())}
        {firstName ? `, ${firstName}` : ''}
      </Text>

      <SearchBar large placeholder={t('home.searchPlaceholder')} onPressFake={() => router.push({ pathname: '/search', params: { focus: '1' } })} />

      {/* Compare shortcut */}
      <Card tone="primary" onPress={() => router.push('/compare')} style={{ marginTop: spacing.lg, marginBottom: spacing.xxl, borderRadius: radius.xxl }} testID="compare-shortcut">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="h3" style={{ color: '#FFFFFF' }}>
              {t('home.compareTitle')}
            </Text>
            <Text variant="small" style={{ color: 'rgba(255,255,255,0.78)' }}>
              {compareCount ? t('home.compareCount', { count: compareCount }) : t('home.compareBody')}
            </Text>
          </View>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette.mint400, alignItems: 'center', justifyContent: 'center' }}>
            <ArrowRight size={20} color={palette.forest900} strokeWidth={2.4} />
          </View>
        </View>
      </Card>

      {/* Shortcuts */}
      <View style={{ flexDirection: 'row', marginBottom: spacing.xxl }}>
        <Shortcut testID="sc-open-now" icon={Clock3} label={t('home.scNearby')} onPress={() => router.push({ pathname: '/pharmacies', params: { openNow: '1' } })} />
        <Shortcut icon={Heart} label={t('home.scFavorites')} onPress={() => router.push('/profile/favorites')} />
        <Shortcut icon={History} label={t('home.scHistory')} onPress={() => router.push('/profile/history')} />
        <Shortcut icon={Tags} label={t('home.scPrices')} onPress={() => router.push({ pathname: '/search', params: { hasPrice: '1' } })} />
      </View>

      {/* Nearby pharmacies */}
      <Section title={t('home.nearby')} action={t('common.seeAll')} onAction={() => router.push('/pharmacies')}>
        {location.status === 'granted' ? (
          nearby.isLoading ? (
            <Skeleton height={120} round={radius.xl} />
          ) : nearby.error ? (
            <ErrorState error={nearby.error} onRetry={() => nearby.refetch()} compact />
          ) : nearbyItems.length ? (
            <FlatList
              horizontal
              data={nearbyItems.slice(0, 8)}
              keyExtractor={(p) => p.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.xl }}
              style={{ marginRight: -spacing.xl }}
              renderItem={({ item }) => <PharmacyCard pharmacy={item} compact />}
            />
          ) : (
            <Text color="textSecondary">{t('home.nearbyEmpty')}</Text>
          )
        ) : (
          <Card tone="alt">
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <MapPin size={22} color={colors.primary} />
              <Text variant="small" color="textSecondary" style={{ flex: 1 }}>
                {t('home.nearbyFallback')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Chip label={t('home.enableLocation')} icon={LocateFixed} selected onPress={location.request} />
              <Chip label={t('pharmacies.title')} onPress={() => router.push('/pharmacies')} />
            </View>
          </Card>
        )}
      </Section>

      {popularSearches.data?.length ? (
        <Section title={t('home.popularSearches')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {popularSearches.data.map((q) => (
              <Chip key={q} label={q} onPress={() => router.push({ pathname: '/search', params: { q } })} />
            ))}
          </View>
        </Section>
      ) : null}

      {recentMedicines.length ? (
        <Section title={t('home.recent')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {recentMedicines.slice(0, 6).map((m) => (
              <Chip key={m.id} label={m.name} icon={History} onPress={() => router.push(`/medicine/${m.id}`)} />
            ))}
          </View>
        </Section>
      ) : null}

      {favoriteMeds.length ? (
        <Section title={t('home.favorites')} action={t('common.seeAll')} onAction={() => router.push('/profile/favorites')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {favoriteMeds.slice(0, 6).map((m) => (
              <Chip key={m.id} label={m.name} icon={Heart} onPress={() => router.push(`/medicine/${m.id}`)} />
            ))}
          </View>
        </Section>
      ) : null}

      {recentPharmacies.length ? (
        <Section title={t('home.recentPharmacies')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {recentPharmacies.slice(0, 4).map((p) => (
              <Chip key={p.id} label={p.name} icon={MapPin} onPress={() => router.push(`/pharmacy/${p.id}`)} />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title={t('home.popularMedicines')} action={t('common.seeAll')} onAction={() => router.push('/search')}>
        {popular.isLoading ? (
          <Skeleton height={170} round={radius.xl} />
        ) : popular.error ? (
          <ErrorState error={popular.error} onRetry={() => popular.refetch()} compact />
        ) : (
          <FlatList
            horizontal
            data={popular.data ?? []}
            keyExtractor={(m) => m.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.xl }}
            style={{ marginRight: -spacing.xl }}
            renderItem={({ item }) => <MedicineCard medicine={item} compact />}
          />
        )}
      </Section>

      {categories.data?.some((c) => c.count > 0) ? (
        <Section title={t('home.categories')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {categories.data
              .filter((c) => c.count > 0)
              .map((c) => (
                <Pressable
                  key={c.code}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/search', params: { atc: c.code } })}
                  style={({ pressed }) => ({
                    width: '48.5%',
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                    gap: 2,
                  })}
                >
                  <Text variant="caption" color="primary">
                    ATC {c.code}
                  </Text>
                  <Text variant="small" style={{ fontFamily: 'Manrope_700Bold' }} numberOfLines={2}>
                    {c.name}
                  </Text>
                  <Text variant="small" color="textTertiary">
                    {c.count}
                  </Text>
                </Pressable>
              ))}
          </View>
        </Section>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt }}>
        <ShieldCheck size={18} color={colors.textSecondary} />
        <Text variant="small" color="textSecondary" style={{ flex: 1 }}>
          {t('common.notAdvice')}
        </Text>
      </View>
    </Screen>
  );
}
