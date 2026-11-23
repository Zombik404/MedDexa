import type { Difference } from '@meddexa/shared';
import { useRouter } from 'expo-router';
import { Check, GitCompareArrows, History, Plus, Star, Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { useCompareQuery, useComparisonHistory, useMedicineSearch, useSignedIn } from '@/api/hooks';
import { AssessmentBanner, DifferenceList, useAssessmentTone } from '@/components/medicine/Assessment';
import { CompareMatrix } from '@/components/medicine/CompareMatrix';
import { ingredientLine } from '@/components/medicine/MedicineCard';
import { Screen } from '@/components/Screen';
import { Button, Card, EmptyState, ErrorState, ListSkeleton, SearchBar, Section, Sheet, Text } from '@/components/ui';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { formatDate } from '@/lib/format';
import { useCompare } from '@/store/compare';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

function AddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const items = useCompare((s) => s.items);
  const toggle = useCompare((s) => s.toggle);
  const results = useMedicineSearch({ q: q.trim() || undefined, sort: q.trim() ? 'relevance' : 'name' }, visible);
  const list = results.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Sheet visible={visible} onClose={onClose} title={t('compare.add')} footer={<Button label={t('common.done')} onPress={onClose} full />}>
      <SearchBar testID="compare-add-input" value={q} onChangeText={setQ} onClear={() => setQ('')} placeholder={t('search.placeholder')} autoFocus />
      <View style={{ gap: spacing.sm }}>
        {list.slice(0, 25).map((m) => {
          const selected = items.some((i) => i.id === m.id);
          return (
            <Pressable
              key={m.id}
              testID={`compare-add-${m.id}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggle({ id: m.id, name: m.name })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: colors.surface }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {m.name}
                </Text>
                <Text variant="small" color="textSecondary" numberOfLines={1}>
                  {ingredientLine(m)}
                </Text>
              </View>
              <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: selected ? colors.primary : colors.borderStrong, backgroundColor: selected ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {selected ? <Check size={15} color={colors.textOnPrimary} strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

export default function CompareScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { items, remove, makeReference, clear, replace, localHistory, remember } = useCompare();
  const signedIn = useSignedIn();
  const remoteHistory = useComparisonHistory();
  const [adding, setAdding] = useState(false);
  const ids = items.map((i) => i.id);
  const q = useCompareQuery(ids);

  useEffect(() => {
    if (q.data && !signedIn) remember(items);
  }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const history = signedIn
    ? (remoteHistory.data ?? []).map((h) => ({ key: h.id, ids: h.medicineIds, names: h.medicineNames, at: h.createdAt }))
    : localHistory.map((h) => ({ key: h.ids.join(','), ...h }));

  const nameOf = (id: string) => q.data?.medicines.find((m) => m.id === id)?.name ?? '';
  const diffLabel = (side: 'ref' | 'other', d: Difference) => {
    const v = side === 'ref' ? d.reference : d.other;
    if (v == null) return '—';
    if (d.code === 'DIFFERENT_RELEASE') return t(`release.${v}`);
    if (d.code === 'DIFFERENT_ROUTE') return t(`route.${v}`, { defaultValue: v });
    return v;
  };

  return (
    <Screen title={t('compare.title')} subtitle={t('compare.subtitle')} right={items.length ? <Button label={t('compare.clear')} icon={Trash2} variant="ghost" size="sm" onPress={clear} /> : null}>
      {/* Selection */}
      <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
        {items.map((item, i) => (
          <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: i === 0 ? colors.primarySoft : colors.surface, borderWidth: 1, borderColor: i === 0 ? colors.primary : colors.border }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: i === 0 ? colors.primary : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="caption" style={{ color: i === 0 ? colors.textOnPrimary : colors.textSecondary }}>
                {i + 1}
              </Text>
            </View>
            <Pressable style={{ flex: 1 }} accessibilityRole="link" onPress={() => router.push(`/medicine/${item.id}`)}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {item.name}
              </Text>
              {i === 0 ? (
                <Text variant="caption" color="primary" style={{ textTransform: 'uppercase' }}>
                  {t('compare.reference')}
                </Text>
              ) : null}
            </Pressable>
            {i > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('compare.makeReference')} hitSlop={8} onPress={() => makeReference(item.id)}>
                <Star size={18} color={colors.textTertiary} />
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={8} onPress={() => remove(item.id)}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
        <Button testID="compare-add" label={t('compare.add')} icon={Plus} variant={items.length ? 'secondary' : 'primary'} onPress={() => setAdding(true)} disabled={items.length >= 6} />
        {items.length === 1 ? (
          <Text variant="small" color="textSecondary" align="center">
            {t('compare.needTwo')}
          </Text>
        ) : null}
      </View>

      {items.length === 0 ? <EmptyState icon={GitCompareArrows} title={t('compare.emptyTitle')} body={t('compare.emptyBody')} compact /> : null}

      {items.length >= 2 ? (
        q.isLoading ? (
          <ListSkeleton count={2} />
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.data ? (
          <>
            <Section>
              <AssessmentBanner assessment={q.data.result.summary.assessment} composition={q.data.result.summary.composition} critical={q.data.result.summary.criticalCount} major={q.data.result.summary.majorCount} />
            </Section>

            <Section title={t('compare.differences')}>
              <View style={{ gap: spacing.md }}>
                {q.data.result.pairs.map((p) => (
                  <PairCard key={p.otherId} title={`${nameOf(p.otherId)} ${t('compare.versus')}`} assessment={p.assessment}>
                    <Text variant="small" color="textSecondary">
                      {t(`composition.${p.composition}`)}
                    </Text>
                    <DifferenceList differences={p.differences} labels={diffLabel} />
                  </PairCard>
                ))}
              </View>
            </Section>

            <Section title={t('compare.ingredients')}>
              <View style={{ marginRight: -spacing.xl }}>
                <CompareMatrix medicines={q.data.medicines} result={q.data.result} prices={q.data.prices} />
              </View>
            </Section>

            <View style={{ padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.infoSoft, marginBottom: spacing.xxl }}>
              <Text variant="small" color="text">
                {t('compare.disclaimer')}
              </Text>
            </View>
          </>
        ) : null
      ) : null}

      <Section title={t('compare.history')}>
        {history.length ? (
          <ListGroup>
            {history.slice(0, 10).map((h, i, arr) => (
              <ListRow
                key={h.key}
                icon={History}
                title={h.names.join(' · ')}
                subtitle={formatDate(h.at)}
                onPress={() => replace(h.ids.map((id, idx) => ({ id, name: h.names[idx] ?? '' })))}
                last={i === arr.length - 1}
              />
            ))}
          </ListGroup>
        ) : (
          <Text variant="small" color="textSecondary">
            {t('compare.noHistory')}
          </Text>
        )}
      </Section>

      <AddSheet visible={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

function PairCard({ title, assessment, children }: { title: string; assessment: Parameters<typeof useAssessmentTone>[0]; children: React.ReactNode }) {
  const tone = useAssessmentTone(assessment);
  const { t } = useTranslation();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <tone.Icon size={18} color={tone.fg} />
        <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <Text variant="small" style={{ color: tone.fg, fontFamily: 'Manrope_700Bold', marginBottom: 4 }}>
        {t(`assessment.${assessment}`)}
      </Text>
      <View style={{ gap: spacing.sm }}>{children}</View>
    </Card>
  );
}
