import type { MedicineSearchQuery, Suggestion } from '@meddexa/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUpDown, Building2, Clock, FlaskConical, Layers, Pill, SlidersHorizontal, TrendingUp, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Keyboard, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMedicineSearch, useMeta, usePopularSearches, useSearchHistory, useSignedIn, useSuggestions } from '@/api/hooks';
import { MedicineCard } from '@/components/medicine/MedicineCard';
import { Button, Chip, EmptyState, ErrorState, ListSkeleton, SearchBar, Sheet, Text, TextField } from '@/components/ui';
import { ListRow } from '@/components/ui/ListRow';
import { useLocal } from '@/store/local';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Filters = Partial<Pick<MedicineSearchQuery, 'ingredients' | 'manufacturer' | 'atc' | 'form' | 'route' | 'prescription' | 'country' | 'strength' | 'packageSize' | 'barcode' | 'registrationNumber' | 'hasPrice'>>;
type Sort = MedicineSearchQuery['sort'];

const SUGGEST_ICON = { medicine: Pill, ingredient: FlaskConical, manufacturer: Building2, atc: Layers } as const;

function useDebounced<T>(value: T, ms = 280) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function SearchScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; focus?: string; atc?: string; hasPrice?: string; ingredients?: string }>();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const meta = useMeta();
  const signedIn = useSignedIn();
  const local = useLocal();
  const saveHistory = usePreferences((s) => s.saveSearchHistory);
  const serverHistory = useSearchHistory();
  const popular = usePopularSearches();

  const [text, setText] = useState(params.q ?? '');
  const [submitted, setSubmitted] = useState(params.q ?? '');
  const [focused, setFocused] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const [draft, setDraft] = useState<Filters>({});
  const [sort, setSort] = useState<Sort>('relevance');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // Deep links from Home (category, prices shortcut, popular search). The tab stays mounted,
  // so incoming params are applied when they change (React's "adjust state on prop change").
  const paramKey = [params.q, params.atc, params.hasPrice, params.ingredients].join('|');
  const [seenParams, setSeenParams] = useState<string | null>(null);
  if (paramKey !== seenParams) {
    setSeenParams(paramKey);
    if (params.q !== undefined) {
      setText(params.q);
      setSubmitted(params.q);
    }
    if (params.atc || params.hasPrice || params.ingredients) {
      setFilters((f) => ({ ...f, atc: params.atc || undefined, hasPrice: params.hasPrice ? true : undefined, ingredients: params.ingredients ? params.ingredients.split(',') : undefined }));
    }
  }
  useEffect(() => {
    if (!params.focus) return;
    const id = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(id);
  }, [params.focus]);

  const debounced = useDebounced(text);
  const suggestions = useSuggestions(focused && debounced !== submitted ? debounced : '');
  const activeFilters = Object.entries(filters).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length));
  const hasQuery = submitted.trim().length > 0 || activeFilters.length > 0;
  const query = useMemo(() => ({ q: submitted.trim() || undefined, ...filters, sort }), [submitted, filters, sort]);
  const results = useMedicineSearch(query, hasQuery);
  const items = results.data?.pages.flatMap((p) => p.items) ?? [];
  const total = results.data?.pages[0]?.total ?? 0;

  const submit = (q: string) => {
    setText(q);
    setSubmitted(q);
    Keyboard.dismiss();
    if (saveHistory && q.trim()) local.addSearch(q);
  };

  const onSuggestion = (s: Suggestion) => {
    if (s.type === 'medicine') return router.push(`/medicine/${s.id}`);
    if (s.type === 'ingredient') {
      setFilters((f) => ({ ...f, ingredients: [s.label] }));
      return submit('');
    }
    if (s.type === 'manufacturer') {
      setFilters((f) => ({ ...f, manufacturer: s.label }));
      return submit('');
    }
    setFilters((f) => ({ ...f, atc: s.id }));
    submit('');
  };

  const recent = signedIn ? [...new Set((serverHistory.data ?? []).map((h) => h.query))].slice(0, 8) : local.recentSearches;
  const showSuggestions = focused && text.trim().length >= 2 && text !== submitted;

  const filterLabel = (k: string, v: unknown) => {
    if (k === 'hasPrice') return t('search.f.hasPrice');
    if (k === 'prescription') return t(`rx.${v}`);
    if (k === 'route') return t(`route.${v}`, { defaultValue: String(v) });
    if (k === 'form') return meta.data?.forms.find((f) => f.code === v)?.name ?? String(v);
    return Array.isArray(v) ? v.join(' + ') : String(v);
  };

  const header = (
    <View style={{ paddingHorizontal: spacing.xl, paddingTop: insets.top + spacing.lg, gap: spacing.md, backgroundColor: colors.background }}>
      <Text variant="h1" accessibilityRole="header">
        {t('search.title')}
      </Text>
      <SearchBar
        ref={input}
        testID="search-input"
        value={text}
        placeholder={t('search.placeholder')}
        onChangeText={setText}
        onSubmitEditing={() => submit(text)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onClear={() => {
          setText('');
          setSubmitted('');
        }}
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Chip testID="open-filters" icon={SlidersHorizontal} label={activeFilters.length ? `${t('search.filters')} · ${activeFilters.length}` : t('search.advanced')} selected={activeFilters.length > 0} onPress={() => { setDraft(filters); setFiltersOpen(true); }} />
        <Chip icon={ArrowUpDown} label={t(`search.s.${sort}`)} onPress={() => setSortOpen(true)} />
        {activeFilters.map(([k, v]) => (
          <Chip key={k} icon={X} label={filterLabel(k, v)} onPress={() => setFilters((f) => ({ ...f, [k]: undefined }))} />
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      {showSuggestions ? (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={suggestions.data ?? []}
          keyExtractor={(s) => `${s.type}:${s.id}`}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          ListHeaderComponent={
            <Pressable accessibilityRole="button" onPress={() => submit(text)} style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
              <Text variant="bodyStrong" color="primary">
                {t('common.appName')}: “{text}”
              </Text>
            </Pressable>
          }
          renderItem={({ item }) => <ListRow icon={SUGGEST_ICON[item.type]} title={item.label} subtitle={[t(`search.type.${item.type}`), item.secondary].filter(Boolean).join(' · ')} onPress={() => onSuggestion(item)} />}
        />
      ) : !hasQuery ? (
        <FlatList
          data={[]}
          renderItem={() => null}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}
          ListHeaderComponent={
            <View style={{ gap: spacing.xxl }}>
              {recent.length ? (
                <View style={{ gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text variant="h3">{t('search.recent')}</Text>
                    {!signedIn ? (
                      <Pressable accessibilityRole="button" onPress={local.clearSearches}>
                        <Text variant="small" color="primary">
                          {t('common.clear')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {recent.map((q) => (
                      <Chip key={q} icon={Clock} label={q} onPress={() => submit(q)} />
                    ))}
                  </View>
                </View>
              ) : null}
              {popular.data?.length ? (
                <View style={{ gap: spacing.md }}>
                  <Text variant="h3">{t('search.popular')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {popular.data.map((q) => (
                      <Chip key={q} icon={TrendingUp} label={q} onPress={() => submit(q)} />
                    ))}
                  </View>
                </View>
              ) : null}
              <EmptyState icon={Pill} title={t('search.startTitle')} body={t('search.startBody')} compact />
            </View>
          }
        />
      ) : (
        <FlatList
          testID="search-results"
          data={items}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120, gap: spacing.md }}
          onEndReachedThreshold={0.4}
          onEndReached={() => results.hasNextPage && !results.isFetchingNextPage && results.fetchNextPage()}
          ListHeaderComponent={
            results.data ? (
              <Text variant="small" color="textSecondary" accessibilityLiveRegion="polite">
                {t('search.results', { count: total })}
              </Text>
            ) : undefined
          }
          ListEmptyComponent={
            results.isLoading ? (
              <ListSkeleton />
            ) : results.error ? (
              <ErrorState error={results.error} onRetry={() => results.refetch()} />
            ) : (
              <EmptyState
                title={t('search.noResultsTitle')}
                body={t('search.noResultsBody')}
                action={activeFilters.length ? { label: t('search.clearFilters'), onPress: () => setFilters({}) } : undefined}
              />
            )
          }
          ListFooterComponent={results.isFetchingNextPage ? <ListSkeleton count={1} /> : undefined}
          renderItem={({ item }) => <MedicineCard medicine={item} testID={`result-${item.id}`} />}
        />
      )}

      <Sheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('search.advanced')}
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button label={t('common.reset')} variant="secondary" onPress={() => setDraft({})} style={{ flex: 1 }} />
            <Button
              testID="apply-filters"
              label={t('common.apply')}
              onPress={() => {
                setFilters(draft);
                setFiltersOpen(false);
              }}
              style={{ flex: 2 }}
            />
          </View>
        }
      >
        <TextField
          label={t('search.f.ingredients')}
          hint={t('search.f.ingredientsHint')}
          value={(draft.ingredients ?? []).join(', ')}
          onChangeText={(v) => setDraft({ ...draft, ingredients: v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined })}
          autoCapitalize="none"
        />
        <TextField label={t('search.f.strength')} hint={t('search.f.strengthHint')} value={draft.strength ?? ''} onChangeText={(v) => setDraft({ ...draft, strength: v || undefined })} autoCapitalize="none" />
        <TextField label={t('search.f.manufacturer')} value={draft.manufacturer ?? ''} onChangeText={(v) => setDraft({ ...draft, manufacturer: v || undefined })} />
        <View style={{ gap: spacing.sm }}>
          <Text variant="small" color="textSecondary" style={{ fontFamily: 'Manrope_600SemiBold' }}>
            {t('search.f.prescription')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(['OTC', 'PHARMACY_ONLY', 'RX'] as const).map((rx) => (
              <Chip key={rx} label={t(`rx.${rx}`)} selected={draft.prescription === rx} onPress={() => setDraft({ ...draft, prescription: draft.prescription === rx ? undefined : rx })} />
            ))}
          </View>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="small" color="textSecondary" style={{ fontFamily: 'Manrope_600SemiBold' }}>
            {t('search.f.form')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(meta.data?.forms ?? []).map((f) => (
              <Chip key={f.code} label={f.name} selected={draft.form === f.code} onPress={() => setDraft({ ...draft, form: draft.form === f.code ? undefined : f.code })} />
            ))}
          </View>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="small" color="textSecondary" style={{ fontFamily: 'Manrope_600SemiBold' }}>
            {t('search.f.route')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(meta.data?.routes ?? []).map((r) => (
              <Chip key={r} label={t(`route.${r}`, { defaultValue: r })} selected={draft.route === r} onPress={() => setDraft({ ...draft, route: draft.route === r ? undefined : r })} />
            ))}
          </View>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="small" color="textSecondary" style={{ fontFamily: 'Manrope_600SemiBold' }}>
            {t('search.f.country')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(meta.data?.countries ?? []).map((c) => (
              <Chip key={c.code} label={c.code} selected={draft.country === c.code} onPress={() => setDraft({ ...draft, country: draft.country === c.code ? undefined : c.code })} />
            ))}
          </View>
        </View>
        <TextField label={t('search.f.atc')} value={draft.atc ?? ''} onChangeText={(v) => setDraft({ ...draft, atc: v ? v.toUpperCase() : undefined })} autoCapitalize="characters" />
        <TextField label={t('search.f.packageSize')} value={draft.packageSize ? String(draft.packageSize) : ''} onChangeText={(v) => setDraft({ ...draft, packageSize: Number(v) || undefined })} keyboardType="numeric" />
        <TextField label={t('search.f.barcode')} value={draft.barcode ?? ''} onChangeText={(v) => setDraft({ ...draft, barcode: v.replace(/\D/g, '') || undefined })} keyboardType="number-pad" />
        <TextField label={t('search.f.registrationNumber')} value={draft.registrationNumber ?? ''} onChangeText={(v) => setDraft({ ...draft, registrationNumber: v || undefined })} autoCapitalize="characters" />
        <ListRow title={t('search.f.hasPrice')} toggle={{ value: !!draft.hasPrice, onChange: (v) => setDraft({ ...draft, hasPrice: v || undefined }) }} last />
      </Sheet>

      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title={t('search.sort')}>
        <View>
          {(['relevance', 'name', 'price_asc', 'price_desc', 'rating'] as const).map((s, i, arr) => (
            <ListRow
              key={s}
              title={t(`search.s.${s}`)}
              right={sort === s ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
              onPress={() => {
                setSort(s);
                setSortOpen(false);
              }}
              last={i === arr.length - 1}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}
