import { useLocalSearchParams } from 'expo-router';
import { BadgeCheck, Clock3, LocateFixed, RotateCw, Star } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeta, usePharmacySearch } from '@/api/hooks';
import PharmacyMap from '@/components/pharmacy/PharmacyMap';
import { PharmacyCard } from '@/components/pharmacy/PharmacyCard';
import { Chip, EmptyState, ErrorState, ListSkeleton, SearchBar, Segmented, Text } from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { flag } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function PharmaciesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ openNow?: string }>();
  const location = useLocation(true);
  const meta = useMeta();

  const [mode, setMode] = useState<'map' | 'list'>('list');
  const [text, setText] = useState('');
  const [country, setCountry] = useState<string | undefined>();
  const [openNow, setOpenNow] = useState(!!params.openNow);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [minRating, setMinRating] = useState(false);
  const [area, setArea] = useState<{ lat: number; lng: number; radiusKm: number } | null>(null);
  const [pendingArea, setPendingArea] = useState<typeof area>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const q = useDebounced(text.trim());

  useEffect(() => {
    if (params.openNow) setOpenNow(true);
  }, [params.openNow]);

  const center = area ?? (location.coords ? { ...location.coords, radiusKm: 10 } : null);
  const query = useMemo(
    () => ({
      q: q || undefined,
      country,
      openNow: openNow || undefined,
      verifiedOnly: verifiedOnly || undefined,
      minRating: minRating ? 4 : undefined,
      // Text search spans the whole of Europe; otherwise search around the user or map area.
      ...(q || country ? {} : center ? { lat: center.lat, lng: center.lng, radiusKm: center.radiusKm } : {}),
      ...(center && (q || country) ? { lat: center.lat, lng: center.lng, radiusKm: 200 } : {}),
      sort: (center && !q ? 'distance' : 'name') as 'distance' | 'name',
    }),
    [q, country, openNow, verifiedOnly, minRating, center?.lat, center?.lng, center?.radiusKm], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const canSearch = !!(q || country || center);
  const results = usePharmacySearch(query, canSearch);
  const items = results.data?.pages.flatMap((p) => p.items) ?? [];
  const total = results.data?.pages[0]?.total ?? 0;
  const selectedItem = items.find((p) => p.id === selected) ?? null;

  const filterRow = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}>
      <Chip icon={LocateFixed} label={t('pharmacies.nearMe')} selected={!q && !country && location.status === 'granted' && !area} onPress={() => { setText(''); setCountry(undefined); setArea(null); void location.request(); }} />
      <Chip testID="filter-open-now" icon={Clock3} label={t('pharmacies.openNow')} selected={openNow} onPress={() => setOpenNow(!openNow)} />
      <Chip icon={BadgeCheck} label={t('pharmacies.verifiedOnly')} selected={verifiedOnly} onPress={() => setVerifiedOnly(!verifiedOnly)} />
      <Chip icon={Star} label={t('pharmacies.minRating')} selected={minRating} onPress={() => setMinRating(!minRating)} />
      {(meta.data?.countries ?? []).map((c) => (
        <Chip key={c.code} label={`${flag(c.code)} ${c.code}`} selected={country === c.code} onPress={() => setCountry(country === c.code ? undefined : c.code)} />
      ))}
    </ScrollView>
  );

  const body = !canSearch ? (
    <EmptyState icon={LocateFixed} title={t('pharmacies.locationTitle')} body={t('pharmacies.locationBody')} action={{ label: t('home.enableLocation'), onPress: location.request }} />
  ) : results.isLoading ? (
    <View style={{ padding: spacing.xl }}>
      <ListSkeleton />
    </View>
  ) : results.error ? (
    <ErrorState error={results.error} onRetry={() => results.refetch()} />
  ) : mode === 'map' ? (
    <View style={{ flex: 1 }}>
      <PharmacyMap
        pharmacies={items}
        center={selectedItem ? { lat: selectedItem.lat, lng: selectedItem.lng } : center}
        selectedId={selected}
        onSelect={setSelected}
        onRegionChange={setPendingArea}
        showsUser={location.status === 'granted'}
      />
      {pendingArea && (!area || Math.abs(pendingArea.lat - area.lat) > 0.01 || Math.abs(pendingArea.lng - area.lng) > 0.01) && !q ? (
        <View style={{ position: 'absolute', top: spacing.md, alignSelf: 'center' }}>
          <Chip icon={RotateCw} label={t('pharmacies.radius', { km: Math.round(pendingArea.radiusKm) })} selected onPress={() => { setArea(pendingArea); setCountry(undefined); }} />
        </View>
      ) : null}
      {selectedItem ? (
        <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: insets.bottom + 90 }}>
          <PharmacyCard pharmacy={selectedItem} />
        </View>
      ) : null}
    </View>
  ) : (
    <FlatList
      testID="pharmacy-list"
      data={items}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120, gap: spacing.md }}
      onEndReachedThreshold={0.4}
      onEndReached={() => results.hasNextPage && !results.isFetchingNextPage && results.fetchNextPage()}
      ListHeaderComponent={
        <Text variant="small" color="textSecondary">
          {t('pharmacies.results', { count: total })}
        </Text>
      }
      ListEmptyComponent={<EmptyState title={t('pharmacies.emptyTitle')} body={t('pharmacies.emptyBody')} />}
      ListFooterComponent={
        <Text variant="small" color="textTertiary" align="center" style={{ marginTop: spacing.lg }}>
          {t('pharmacies.coverage')}
        </Text>
      }
      renderItem={({ item }) => <PharmacyCard pharmacy={item} testID={`pharmacy-${item.id}`} />}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + spacing.lg, gap: spacing.md, paddingBottom: spacing.md }}>
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
          <Text variant="h1" accessibilityRole="header">
            {t('pharmacies.title')}
          </Text>
          <SearchBar testID="pharmacy-search" value={text} onChangeText={setText} onClear={() => setText('')} placeholder={t('pharmacies.placeholder')} autoCapitalize="words" />
          <Segmented
            value={mode}
            onChange={(m) => {
              setMode(m);
              setSelected(null);
            }}
            options={[
              { value: 'list', label: t('pharmacies.list') },
              { value: 'map', label: t('pharmacies.map') },
            ]}
          />
        </View>
        {filterRow}
      </View>
      {body}
    </View>
  );
}
