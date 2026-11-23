import { useLocalSearchParams, useRouter } from 'expo-router';
import { GitCompareArrows, Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useComparisonHistory, useHistoryMutations, useSearchHistory, useSignedIn } from '@/api/hooks';
import { Screen } from '@/components/Screen';
import { Button, EmptyState, Segmented } from '@/components/ui';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { formatDate } from '@/lib/format';
import { useCompare } from '@/store/compare';
import { useLocal } from '@/store/local';
import { spacing } from '@/theme/tokens';

export default function HistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'compare' | 'search'>(params.tab === 'search' ? 'search' : 'compare');
  const signedIn = useSignedIn();
  const comps = useComparisonHistory();
  const searches = useSearchHistory();
  const { clearSearches, clearComparisons } = useHistoryMutations();
  const local = useLocal();
  const compare = useCompare();

  const compRows = signedIn
    ? (comps.data ?? []).map((c) => ({ key: c.id, ids: c.medicineIds, names: c.medicineNames, at: c.createdAt }))
    : compare.localHistory.map((h) => ({ key: h.ids.join(','), ...h }));
  const searchRows = signedIn ? (searches.data ?? []).map((s) => ({ key: s.id, q: s.query, sub: `${formatDate(s.createdAt)} · ${t('search.results', { count: s.resultCount })}` })) : local.recentSearches.map((q) => ({ key: q, q, sub: '' }));

  return (
    <Screen topInset={false}>
      <View style={{ marginBottom: spacing.xl }}>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'compare', label: t('profile.comparisons') }, { value: 'search', label: t('profile.searches') }]} />
      </View>
      {tab === 'compare' ? (
        compRows.length ? (
          <View style={{ gap: spacing.lg }}>
            <ListGroup>
              {compRows.map((c, i, a) => (
                <ListRow
                  key={c.key}
                  icon={GitCompareArrows}
                  title={c.names.join(' · ')}
                  subtitle={formatDate(c.at)}
                  onPress={() => {
                    compare.replace(c.ids.map((id, idx) => ({ id, name: c.names[idx] ?? '' })));
                    router.push('/compare');
                  }}
                  last={i === a.length - 1}
                />
              ))}
            </ListGroup>
            <Button label={t('common.clear')} variant="danger" size="sm" onPress={() => (signedIn ? clearComparisons.mutate() : useCompare.setState({ localHistory: [] }))} />
          </View>
        ) : (
          <EmptyState icon={GitCompareArrows} title={t('profile.empty')} body={t('compare.noHistory')} />
        )
      ) : searchRows.length ? (
        <View style={{ gap: spacing.lg }}>
          <ListGroup>
            {searchRows.map((s, i, a) => (
              <ListRow key={s.key} icon={Search} title={s.q} subtitle={s.sub || undefined} onPress={() => router.push({ pathname: '/search', params: { q: s.q } })} last={i === a.length - 1} />
            ))}
          </ListGroup>
          <Button label={t('common.clear')} variant="danger" size="sm" onPress={() => (signedIn ? clearSearches.mutate() : local.clearSearches())} />
        </View>
      ) : (
        <EmptyState icon={Search} title={t('profile.empty')} />
      )}
    </Screen>
  );
}
