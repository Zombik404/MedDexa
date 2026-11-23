import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronUp, ExternalLink, FileText, GitCompareArrows, Heart, MapPin, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Share, View } from 'react-native';
import { useMedicine, usePrices, useSimilar, useSignedIn } from '@/api/hooks';
import { IngredientList } from '@/components/medicine/IngredientList';
import { MedicineCard } from '@/components/medicine/MedicineCard';
import { MedicineImage } from '@/components/medicine/MedicineImage';
import { PriceList } from '@/components/medicine/PriceList';
import { ReviewsBlock } from '@/components/Reviews';
import { Screen } from '@/components/Screen';
import { Badge, Button, Card, ErrorState, IconButton, ListSkeleton, ProvenanceLine, Section, Skeleton, Text } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useFavoriteToggle } from '@/hooks/useFavorites';
import { countryName, flag, formatDate } from '@/lib/format';
import { openWebsite } from '@/lib/links';
import { useCompare } from '@/store/compare';
import { useLocal } from '@/store/local';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={{ width: '50%', paddingVertical: spacing.sm, paddingRight: spacing.md }}>
      <Text variant="caption" color="textTertiary" style={{ textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text variant="bodyStrong">{value || '—'}</Text>
    </View>
  );
}

function Collapsible({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: colors.border }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md }}>
        <Text variant="bodyStrong">{title}</Text>
        {open ? <ChevronUp size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
      </Pressable>
      {open ? <View style={{ paddingBottom: spacing.md, gap: spacing.sm }}>{children}</View> : null}
    </View>
  );
}

export default function MedicineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const q = useMedicine(id);
  const prices = usePrices(id);
  const similar = useSimilar(id);
  const signedIn = useSignedIn();
  const fav = useFavoriteToggle();
  const viewed = useLocal((s) => s.viewedMedicine);
  const inCompare = useCompare((s) => s.items.some((i) => i.id === id));
  const toggleCompare = useCompare((s) => s.toggle);
  const m = q.data;

  useEffect(() => {
    if (m && !signedIn) viewed({ id: m.id, name: m.name });
  }, [m?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) {
    return (
      <Screen topInset={false}>
        <Skeleton height={220} round={radius.xxl} />
        <View style={{ height: spacing.lg }} />
        <Skeleton height={28} width="80%" />
        <View style={{ height: spacing.lg }} />
        <ListSkeleton count={3} />
      </Screen>
    );
  }
  if (q.error || !m) return <Screen topInset={false}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;

  const isFav = fav.isMedicine(m.id);
  const sameComposition = (similar.data ?? []).filter((x) => x.composition === 'SAME_ACTIVE_INGREDIENT' || x.composition === 'SAME_COMBINATION');

  return (
    <Screen topInset={false} refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); void prices.refetch(); }}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <IconButton icon={Share2} label={t('common.share')} tone="plain" size={36} onPress={() => void Share.share({ message: `${m.name} — MedDexa` })} />
          ),
        }}
      />

      {/* Picture first, then what it is */}
      <MedicineImage medicine={m} size="hero" testID="medicine-image" />
      <View style={{ marginTop: spacing.lg, gap: 4 }}>
        <Text variant="h1" accessibilityRole="header">
          {m.name}
        </Text>
        <Text variant="body" color="textSecondary">
          {[m.manufacturer, countryName(m.countryCode)].filter(Boolean).join(' · ')} {flag(m.countryCode)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md }}>
        <Badge label={t(`rx.${m.prescription}`)} tone={m.prescription === 'RX' ? 'info' : 'neutral'} />
        {m.form ? <Badge label={m.form.name} tone="primary" /> : null}
        {m.release && m.release !== 'IMMEDIATE' && m.release !== 'UNKNOWN' ? <Badge label={t(`release.${m.release}`)} tone="warning" /> : null}
      </View>
      {m.isDemo ? (
        <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningSoft, marginTop: spacing.md }}>
          <Text variant="small" color="warning">
            {t('medicine.demoNotice')}
          </Text>
        </View>
      ) : null}

      {/* Active ingredients directly under the picture */}
      <Text variant="h3" style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>
        {t('medicine.ingredients')}
      </Text>
      <IngredientList
        ingredients={m.ingredients}
        onPressIngredient={(i) => router.push({ pathname: '/search', params: { ingredients: i.moietyName ?? i.substanceName } })}
      />

      {/* Primary action, then secondary ones */}
      <Button
        testID="detail-compare"
        label={inCompare ? t('medicine.inCompare') : t('medicine.addCompare')}
        icon={inCompare ? Check : GitCompareArrows}
        variant={inCompare ? 'soft' : 'primary'}
        onPress={() => {
          const r = toggleCompare({ id: m.id, name: m.name });
          if (r === 'full') toast(t('compare.full'), 'info');
          if (r === 'added') toast(t('medicine.inCompare'));
        }}
        style={{ marginTop: spacing.xl }}
        full
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xxl }}>
        <Button label={t('medicine.findPharmacy')} icon={MapPin} variant="secondary" size="sm" onPress={() => router.push('/pharmacies')} style={{ flex: 1 }} />
        <Button
          testID="favorite-medicine"
          label={isFav ? t('medicine.saved') : t('medicine.save')}
          icon={Heart}
          variant={isFav ? 'soft' : 'secondary'}
          size="sm"
          onPress={() => fav.toggleMedicine({ id: m.id, name: m.name })}
          style={{ flex: 1 }}
        />
      </View>

      <Section title={t('medicine.prices')}>{prices.isLoading ? <ListSkeleton count={2} /> : prices.data ? <PriceList data={prices.data} /> : <ErrorState error={prices.error} onRetry={() => prices.refetch()} compact />}</Section>

      {sameComposition.length ? (
        <Section title={t('medicine.sameComposition')}>
          <View style={{ gap: spacing.sm }}>
            {sameComposition.slice(0, 5).map((s) => (
              <MedicineCard key={s.medicine.id} medicine={s.medicine} />
            ))}
          </View>
          <Text variant="small" color="textTertiary" style={{ marginTop: spacing.sm }}>
            {t('compare.disclaimer')}
          </Text>
        </Section>
      ) : null}

      {/* Everything else stays folded away */}
      <Card style={{ marginBottom: spacing.xxl }} padded={false}>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Collapsible title={t('medicine.details')} first>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Detail label={t('medicine.form')} value={m.form?.name} />
              <Detail label={t('medicine.route')} value={m.route ? t(`route.${m.route}`, { defaultValue: m.route }) : null} />
              <Detail label={t('medicine.package')} value={m.packageSize ? `${m.packageSize.quantity} ${m.packageSize.unit}` : null} />
              <Detail label={t('medicine.atc')} value={m.atcCode} />
              <Detail label={t('medicine.barcodes')} value={m.codes.filter((c) => c.system === 'GTIN').map((c) => c.code.replace(/^0/, '')).join(', ') || m.barcodes.join(', ')} />
              <Detail label={t('medicine.prescription')} value={t(`rx.${m.prescription}`)} />
            </View>
            <ProvenanceLine provenance={m.provenance} />
          </Collapsible>
          <Collapsible title={t('medicine.officialInfo')}>
            <Text variant="small" color="textSecondary">
              {t('medicine.officialNote')}
            </Text>
            {m.safety.map((s) => (
              <View key={`${s.kind}-${s.language}-${s.countryCode}`} style={{ gap: 4 }}>
                <Text variant="bodyStrong">{`${t(`medicine.safety.${s.kind}`)}${s.countryCode ? ` · ${flag(s.countryCode)}` : ''}`}</Text>
                <Text variant="body">{s.content}</Text>
                <ProvenanceLine provenance={s.provenance} />
              </View>
            ))}
            {m.documents.length ? (
              m.documents.map((d) => (
                <Pressable key={d.id} accessibilityRole="link" onPress={() => void openWebsite(d.url)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <FileText size={16} color={colors.primary} />
                  <Text variant="small" color="primary" style={{ flex: 1 }}>
                    {t(`medicine.doc.${d.kind}`)} · {d.language.toUpperCase()} {flag(d.countryCode)}
                  </Text>
                  <ExternalLink size={14} color={colors.textTertiary} />
                </Pressable>
              ))
            ) : (
              <Text variant="small" color="textSecondary">
                {t('medicine.noDocuments')}
              </Text>
            )}
          </Collapsible>
          {m.registrations.length ? (
            <Collapsible title={t('medicine.registrations')}>
              <Text variant="small" color="textSecondary">
                {t('medicine.registrationsNote')}
              </Text>
              {m.registrations.map((r) => (
                <View key={r.id} style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Text style={{ fontSize: 20 }}>{flag(r.countryCode)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{r.localName}</Text>
                    <Text variant="small" color="textSecondary">
                      {r.authority} · {r.registrationNumber ?? '—'}
                      {r.authorisedAt ? ` · ${formatDate(r.authorisedAt)}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </Collapsible>
          ) : null}
          <Collapsible title={t('medicine.reviews')}>
            <ReviewsBlock target="medicines" id={m.id} name={m.name} />
          </Collapsible>
        </View>
      </Card>

      <Text variant="small" color="textTertiary">
        {t('common.notAdvice')}
      </Text>
    </Screen>
  );
}
