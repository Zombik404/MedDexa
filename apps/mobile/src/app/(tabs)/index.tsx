import type { PharmacySummary } from '@meddexa/shared';
import { useRouter } from 'expo-router';
import { Camera, ChevronRight, LocateFixed, MapPin, ScanBarcode, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useCategories, usePharmacySearch } from '@/api/hooks';
import { CategoryTile } from '@/components/CategoryTile';
import { OpenBadge } from '@/components/pharmacy/PharmacyCard';
import { Screen } from '@/components/Screen';
import { Button, ErrorState, Section, Skeleton, Text, Wordmark } from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { formatDistance } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow, spacing } from '@/theme/tokens';

/** Search field with the two other ways to find a medicine right inside it. */
function HomeSearch() {
  const { t } = useTranslation();
  const { colors, dark } = useTheme();
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 60,
        paddingLeft: spacing.lg,
        paddingRight: spacing.xs,
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        ...(dark ? {} : shadow(colors, 2)),
      }}
    >
      <Pressable
        testID="home-search"
        accessibilityRole="search"
        accessibilityLabel={t('home.searchPlaceholder')}
        onPress={() => router.push({ pathname: '/search', params: { focus: String(Date.now()) } })}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: '100%' }}
      >
        <Search size={22} color={colors.primary} strokeWidth={2.2} />
        <Text variant="body" color="textTertiary" numberOfLines={1} style={{ flex: 1, fontSize: 16 }}>
          {t('home.searchPlaceholder')}
        </Text>
      </Pressable>
      {[
        { icon: ScanBarcode, label: t('scan.title'), path: '/scan' as const, id: 'home-scan' },
        { icon: Camera, label: t('photo.title'), path: '/photo' as const, id: 'home-photo' },
      ].map(({ icon: Icon, label, path, id }) => (
        <Pressable
          key={id}
          testID={id}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => router.push(path)}
          hitSlop={4}
          style={({ pressed }) => ({ width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.primarySoft : 'transparent' })}
        >
          <Icon size={23} color={colors.text} strokeWidth={2} />
        </Pressable>
      ))}
    </View>
  );
}

function NearbyRow({ pharmacy: p, last }: { pharmacy: PharmacySummary; last: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.name}, ${p.address}`}
      onPress={() => router.push(`/pharmacy/${p.id}`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      })}
    >
      <MapPin size={20} color={colors.primary} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {p.name}
        </Text>
        <Text variant="small" color="textSecondary" numberOfLines={1}>
          {[formatDistance(p.distanceKm), p.address].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <OpenBadge open={p.openNow} />
      <ChevronRight size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const location = useLocation(true);
  const categories = useCategories();
  const nearby = usePharmacySearch(
    { lat: location.coords?.lat, lng: location.coords?.lng, radiusKm: 10, sort: 'distance' },
    location.status === 'granted' && !!location.coords,
  );
  const nearbyItems = (nearby.data?.pages[0]?.items ?? []).slice(0, 3);

  return (
    <Screen
      refreshing={nearby.isRefetching}
      onRefresh={() => {
        void nearby.refetch();
        void categories.refetch();
      }}
    >
      <View style={{ marginBottom: spacing.xl }}>
        <Wordmark size={20} />
      </View>

      {/* 1 — Search: by name, ingredient, barcode or photo */}
      <Text variant="h1" accessibilityRole="header" style={{ marginBottom: spacing.md }}>
        {t('home.title')}
      </Text>
      <HomeSearch />
      <Text variant="small" color="textSecondary" style={{ marginTop: spacing.sm, marginBottom: spacing.xxl }}>
        {t('home.searchHint')}
      </Text>

      {/* 2 — Nearest pharmacies */}
      <Section title={t('home.nearby')} action={location.status === 'granted' ? t('common.seeAll') : undefined} onAction={() => router.push('/pharmacies')}>
        {location.status === 'granted' ? (
          nearby.isLoading ? (
            <Skeleton height={180} round={radius.xl} />
          ) : nearby.error ? (
            <ErrorState error={nearby.error} onRetry={() => nearby.refetch()} compact />
          ) : nearbyItems.length ? (
            <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {nearbyItems.map((p, i) => (
                <NearbyRow key={p.id} pharmacy={p} last={i === nearbyItems.length - 1} />
              ))}
            </View>
          ) : (
            <Text color="textSecondary">{t('home.nearbyEmpty')}</Text>
          )
        ) : location.status === 'locating' ? (
          <Skeleton height={120} round={radius.xl} />
        ) : (
          <View style={{ padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surfaceAlt, gap: spacing.md }}>
            <Text variant="small" color="textSecondary">
              {t('home.nearbyFallback')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button testID="enable-location" label={t('home.enableLocation')} icon={LocateFixed} size="sm" onPress={location.request} />
              <Button label={t('home.openMap')} variant="secondary" size="sm" onPress={() => router.push('/pharmacies')} />
            </View>
          </View>
        )}
      </Section>

      {/* 3 — Categories */}
      <Section title={t('home.categories')}>
        {categories.isLoading ? (
          <Skeleton height={200} round={radius.xl} />
        ) : categories.error ? (
          <ErrorState error={categories.error} onRetry={() => categories.refetch()} compact />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(categories.data ?? []).map((c) => (
              <CategoryTile key={c.slug} slug={c.slug} icon={c.icon} onPress={() => router.push({ pathname: '/search', params: { category: c.slug } })} />
            ))}
          </View>
        )}
      </Section>

      <Text variant="small" color="textTertiary" align="center">
        {t('common.notAdvice')}
      </Text>
    </Screen>
  );
}
