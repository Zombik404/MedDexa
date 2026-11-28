import type { MedicineSearchQuery, Suggestion } from '@meddexa/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUpDown, Building2, Camera, ChevronRight, Clock, FlaskConical, Layers, Pill, ScanBarcode, SlidersHorizontal, X, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Keyboard, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCategories, useIngredientSearch, useMedicineSearch, useMeta, useSearchHistory, useSignedIn, useSuggestions } from '@/api/hooks';
import { MedicineCard } from '@/components/medicine/MedicineCard';
import { CategoryIcon } from '@/components/CategoryTile';
import { CountryList, TypeaheadField } from '@/components/search/TypeaheadField';
import { useDebounced } from '@/hooks/useDebounced';
import { countryName, flag } from '@/lib/format';
import { Button, Chip, EmptyState, ErrorState, IconButton, ListSkeleton, SearchBar, Sheet, Text } from '@/components/ui';
import { ListRow } from '@/components/ui/ListRow';
import { useLocal } from '@/store/local';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

type Filters = Partial<Pick<MedicineSearchQuery, 'ingredients' | 'manufacturer' | 'atc' | 'category' | 'form' | 'route' | 'prescription' | 'country' | 'strength' | 'packageSize' | 'barcode' | 'registrationNumber' | 'hasPrice'>>;
type Sort = MedicineSearchQuery['sort'];

const SUGGEST_ICON = { medicine: Pill, ingredient: FlaskConical, manufacturer: Building2, atc: Layers } as const;

/** Big, explicit entry points for the two non-typing ways to search. */
function ActionRow({ icon: Icon, title, body, onPress, testID }: { icon: LucideIcon; title: string; body: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        padding: spacing.lg,
        borderRadius: radius.xl,
        backgroundColor: pressed ? colors.primarySoft : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      <View style={{ width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={24} color={colors.primary} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" color="textSecondary">
          {body}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

function GroupTitle({ children }: { children: string }) {
  return (
    <Text variant="caption" color="textTertiary" style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xs, textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}

export default function SearchScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; focus?: string; atc?: string; category?: string; hasPrice?: string; ingredients?: string }>();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const meta = useMeta();
  const signedIn = useSignedIn();
  const local = useLocal();
  const saveHistory = usePreferences((s) => s.saveSearchHistory);
  const serverHistory = useSearchHistory();

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
  const paramKey = [params.q, params.atc, params.category, params.hasPrice, params.ingredients].join('|');
  const [seenParams, setSeenParams] = useState<string | null>(null);
  if (paramKey !== seenParams) {
    setSeenParams(paramKey);
    if (params.q !== undefined) {
      setText(params.q);
      setSubmitted(params.q);
    }
    if (params.atc || params.category || params.hasPrice || params.ingredients) {
      // Arriving from a category tile or an ingredient link starts a fresh, single-purpose search.
      setText(params.q ?? '');
      setSubmitted(params.q ?? '');
      setFilters({
        atc: params.atc || undefined,
        category: params.category || undefined,
        hasPrice: params.hasPrice ? true : undefined,
        ingredients: params.ingredients ? params.ingredients.split(',') : undefined,
      });
    }
  }
  useEffect(() => {
    if (!params.focus) return;
    const id = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(id);
  }, [params.focus]);

  const debounced = useDebounced(text);
  const countries = (meta.data?.countries ?? [])
    .map((c) => ({ code: c.code, name: countryName(c.code), flag: flag(c.code) }))
    .sort((x, y) => x.name.localeCompare(y.name));
  const categories = useCategories();
  const typing = focused && debounced !== submitted ? debounced : '';
  const suggestions = useSuggestions(typing);
  const ingredientHits = useIngredientSearch(typing);
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
    if (k === 'category') return t(`category.${v}`);
    if (k === 'country') return `${flag(v as string)} ${countryName(v as string)}`;
    if (k === 'ingredients') return `${t('search.ingredientChip')}: ${(v as string[]).join(' + ')}`;
    if (k === 'prescription') return t(`rx.${v}`);
    if (k === 'route') return t(`route.${v}`, { defaultValue: String(v) });
    if (k === 'form') return meta.data?.forms.find((f) => f.code === v)?.name ?? String(v);
    return Array.isArray(v) ? v.join(' + ') : String(v);
  };

  const header = (
    <View style={{ paddingHorizontal: spacing.xl, paddingTop: insets.top + spacing.md, gap: spacing.md, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
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
              setFilters({});
            }}
          />
        </View>
        <IconButton testID="search-scan" icon={ScanBarcode} label={t('scan.title')} size={48} onPress={() => router.push('/scan')} />
        <IconButton testID="search-photo" icon={Camera} label={t('photo.title')} size={48} onPress={() => router.push('/photo')} />
      </View>
      {hasQuery && !showSuggestions ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          {activeFilters.map(([k, v]) => (
            <Chip key={k} icon={X} label={filterLabel(k, v)} selected onPress={() => setFilters((f) => ({ ...f, [k]: undefined }))} />
          ))}
          <Chip testID="open-filters" icon={SlidersHorizontal} label={t('search.filters')} onPress={() => { setDraft(filters); setFiltersOpen(true); }} />
          <Chip icon={ArrowUpDown} label={t(`search.s.${sort}`)} onPress={() => setSortOpen(true)} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      {showSuggestions ? (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={(suggestions.data ?? []).filter((x) => x.type === 'medicine')}
          keyExtractor={(x) => `${x.type}:${x.id}`}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListHeaderComponent={
            <View>
              <Pressable accessibilityRole="button" onPress={() => submit(text)} style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
                <Text variant="bodyStrong" color="primary">
                  {t('search.searchFor', { q: text })}
                </Text>
              </Pressable>
              {ingredientHits.data?.length ? (
                <View>
                  <GroupTitle>{t('search.ingredientsGroup')}</GroupTitle>
                  {ingredientHits.data.map((h) => (
                    <ListRow
                      key={h.id}
                      icon={FlaskConical}
                      title={h.name}
                      subtitle={[h.synonym, t('search.productCount', { count: h.medicineCount })].filter(Boolean).join(' · ')}
                      onPress={() => {
                        setFilters({ ingredients: [h.name] });
                        submit('');
                      }}
                    />
                  ))}
                </View>
              ) : null}
              {(suggestions.data ?? []).some((x) => x.type === 'medicine') ? <GroupTitle>{t('search.medicinesGroup')}</GroupTitle> : null}
            </View>
          }
          renderItem={({ item }) => <ListRow icon={SUGGEST_ICON[item.type]} title={item.label} subtitle={item.secondary ?? undefined} onPress={() => onSuggestion(item)} />}
        />
      ) : !hasQuery ? (
        <FlatList
          data={[]}
          renderItem={() => null}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}
          ListHeaderComponent={
            <View style={{ gap: spacing.md }}>
              <ActionRow testID="action-scan" icon={ScanBarcode} title={t('scan.title')} body={t('scan.subtitle')} onPress={() => router.push('/scan')} />
              <ActionRow testID="action-photo" icon={Camera} title={t('photo.title')} body={t('photo.subtitle')} onPress={() => router.push('/photo')} />
              {categories.data?.length ? (
                <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
                  <Text variant="h3">{t('home.categories')}</Text>
                  <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.surface }}>
                    {categories.data.map((c, i) => (
                      <Pressable
                        key={c.slug}
                        testID={`search-category-${c.slug}`}
                        accessibilityRole="button"
                        accessibilityLabel={t(`category.${c.slug}`)}
                        onPress={() => {
                          setText('');
                          setSubmitted('');
                          setFilters({ category: c.slug });
                        }}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.md,
                          paddingVertical: spacing.md,
                          paddingHorizontal: spacing.lg,
                          backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                          borderTopWidth: i ? 1 : 0,
                          borderTopColor: colors.border,
                        })}
                      >
                        <CategoryIcon icon={c.icon} size={36} />
                        <Text variant="bodyStrong" style={{ flex: 1 }}>
                          {t(`category.${c.slug}`)}
                        </Text>
                        <Text variant="small" color="textTertiary">
                          {c.count}
                        </Text>
                        <ChevronRight size={18} color={colors.textTertiary} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              {recent.length ? (
                <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
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
              ) : (
                <Text variant="small" color="textSecondary" style={{ marginTop: spacing.md }}>
                  {t('search.startBody')}
                </Text>
              )}
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
        <TypeaheadField
          testID="filter-ingredients"
          field="ingredient"
          multiple
          label={t('search.f.ingredients')}
          values={draft.ingredients ?? []}
          onChange={(v) => setDraft({ ...draft, ingredients: v.length ? v : undefined })}
        />
        <TypeaheadField
          testID="filter-strength"
          field="strength"
          label={t('search.f.strength')}
          values={draft.strength ? [draft.strength] : []}
          onChange={(v) => setDraft({ ...draft, strength: v[0] })}
        />
        <TypeaheadField
          testID="filter-manufacturer"
          field="manufacturer"
          label={t('search.f.manufacturer')}
          values={draft.manufacturer ? [draft.manufacturer] : []}
          onChange={(v) => setDraft({ ...draft, manufacturer: v[0] })}
        />
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
          <CountryList countries={countries} value={draft.country} onChange={(c) => setDraft({ ...draft, country: c })} />
        </View>
        <TypeaheadField
          field="atc"
          label={t('search.f.atc')}
          values={draft.atc ? [draft.atc] : []}
          onChange={(v) => setDraft({ ...draft, atc: v[0] })}
        />
        <TypeaheadField
          field="packageSize"
          label={t('search.f.packageSize')}
          keyboardType="numeric"
          values={draft.packageSize ? [String(draft.packageSize)] : []}
          onChange={(v) => setDraft({ ...draft, packageSize: v[0] ? Number(v[0]) : undefined })}
        />
        <TypeaheadField
          field="registration"
          label={t('search.f.registrationNumber')}
          values={draft.registrationNumber ? [draft.registrationNumber] : []}
          onChange={(v) => setDraft({ ...draft, registrationNumber: v[0] })}
        />
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
