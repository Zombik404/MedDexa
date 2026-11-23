import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronUp, ExternalLink, FileText, GitCompareArrows, Heart, Pill, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Share, View } from 'react-native';
import { Image } from 'expo-image';
import { useMedicine, usePrices, useSimilar, useSignedIn } from '@/api/hooks';
import { IngredientList } from '@/components/medicine/IngredientList';
import { ingredientLine } from '@/components/medicine/MedicineCard';
import { PriceList } from '@/components/medicine/PriceList';
import { ReviewsBlock } from '@/components/Reviews';
import { Screen } from '@/components/Screen';
import { Badge, Button, Card, ErrorState, IconButton, ListSkeleton, ProvenanceLine, Section, Skeleton, Text, VerificationBadge } from '@/components/ui';
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

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
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
        <Skeleton height={28} width="80%" />
        <View style={{ height: spacing.lg }} />
        <ListSkeleton count={3} />
      </Screen>
    );
  }
  if (q.error || !m) return <Screen topInset={false}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;

  const isFav = fav.isMedicine(m.id);

  return (
    <Screen topInset={false} refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); void prices.refetch(); }}>
      <Stack.Screen
        options={{
          title: m.brand ?? '',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <IconButton icon={Share2} label="Share" tone="plain" size={36} onPress={() => void Share.share({ message: `${m.name} — MedDexa` })} />
              <IconButton testID="favorite-medicine" icon={Heart} label={t('pharmacies.save')} active={isFav} tone="plain" size={36} onPress={() => fav.toggleMedicine({ id: m.id, name: m.name })} />
            </View>
          ),
        }}
      />

      {/* Hero */}
      <View style={{ flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.lg }}>
        <View style={{ width: 76, height: 76, borderRadius: radius.xl, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {m.imageUrl ? <Image source={m.imageUrl} style={{ width: 76, height: 76 }} contentFit="cover" accessibilityLabel={m.name} /> : <Pill size={34} color={colors.primary} strokeWidth={1.7} />}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="h1" accessibilityRole="header">
            {m.name}
          </Text>
          <Text variant="body" color="textSecondary">
            {flag(m.countryCode)} {m.manufacturer ?? '—'}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
        {m.form ? <Badge label={m.form.name} tone="primary" /> : null}
        <Badge label={t(`rx.${m.prescription}`)} tone={m.prescription === 'RX' ? 'info' : 'neutral'} />
        {m.release && m.release !== 'IMMEDIATE' ? <Badge label={t(`release.${m.release}`)} tone="warning" /> : null}
        <VerificationBadge provenance={m.provenance} />
      </View>
      {m.isDemo ? (
        <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningSoft, marginBottom: spacing.md }}>
          <Text variant="small" color="warning">
            {t('medicine.demoNotice')}
          </Text>
        </View>
      ) : null}

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
        style={{ marginBottom: spacing.xxl }}
        full
      />

      <Section title={t('medicine.ingredients')}>
        <IngredientList ingredients={m.ingredients} />
      </Section>

      <Section title={t('medicine.details')}>
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Detail label={t('medicine.form')} value={m.form?.name} />
            <Detail label={t('medicine.route')} value={m.route ? t(`route.${m.route}`, { defaultValue: m.route }) : null} />
            <Detail label={t('medicine.release')} value={m.release ? t(`release.${m.release}`) : null} />
            <Detail label={t('medicine.prescription')} value={t(`rx.${m.prescription}`)} />
            <Detail label={t('medicine.package')} value={m.packageSize ? `${m.packageSize.quantity} ${m.packageSize.unit}` : null} />
            <Detail label={t('medicine.atc')} value={m.atcCode} />
            <Detail label={t('medicine.country')} value={countryName(m.countryCode)} />
            <Detail label={t('medicine.barcodes')} value={m.barcodes.join(', ')} />
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <ProvenanceLine provenance={m.provenance} />
          </View>
        </Card>
      </Section>

      <Section title={t('medicine.prices')}>{prices.isLoading ? <ListSkeleton count={2} /> : prices.data ? <PriceList data={prices.data} /> : <ErrorState error={prices.error} onRetry={() => prices.refetch()} compact />}</Section>

      <Section title={t('medicine.officialInfo')}>
        <Card>
          <Text variant="small" color="textSecondary" style={{ marginBottom: spacing.sm }}>
            {t('medicine.officialNote')}
          </Text>
          {m.safety.map((s) => (
            <Collapsible key={`${s.kind}-${s.language}-${s.countryCode}`} title={`${t(`medicine.safety.${s.kind}`)}${s.countryCode ? ` · ${flag(s.countryCode)}` : ''}`}>
              <Text variant="body">{s.content}</Text>
              <ProvenanceLine provenance={s.provenance} />
            </Collapsible>
          ))}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm }}>
            <Text variant="bodyStrong">{t('medicine.documents')}</Text>
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
          </View>
        </Card>
      </Section>

      {m.registrations.length ? (
        <Section title={t('medicine.registrations')}>
          <Text variant="small" color="textSecondary" style={{ marginBottom: spacing.md }}>
            {t('medicine.registrationsNote')}
          </Text>
          <View style={{ gap: spacing.sm }}>
            {m.registrations.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 22 }}>{flag(r.countryCode)}</Text>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{r.localName}</Text>
                  <Text variant="small" color="textSecondary">
                    {r.authority} · {r.registrationNumber ?? '—'}
                    {r.authorisedAt ? ` · ${formatDate(r.authorisedAt)}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {similar.data?.length ? (
        <Section title={t('medicine.similar')}>
          <View style={{ gap: spacing.sm }}>
            {similar.data.slice(0, 8).map((s) => (
              <Card key={s.medicine.id} onPress={() => router.push(`/medicine/${s.medicine.id}`)} accessibilityLabel={s.medicine.name}>
                <Text variant="bodyStrong">{s.medicine.name}</Text>
                <Text variant="small" color="textSecondary" numberOfLines={1}>
                  {ingredientLine(s.medicine)}
                </Text>
                <View style={{ marginTop: 6 }}>
                  <Badge label={t(`composition.${s.composition}`)} tone={s.composition === 'SIMILAR_COMPOSITION' ? 'warning' : 'primary'} />
                </View>
              </Card>
            ))}
          </View>
          <Text variant="small" color="textTertiary" style={{ marginTop: spacing.sm }}>
            {t('compare.disclaimer')}
          </Text>
        </Section>
      ) : null}

      <Section title={t('medicine.reviews')}>
        <ReviewsBlock target="medicines" id={m.id} name={m.name} />
      </Section>

      <Text variant="small" color="textTertiary">
        {t('common.notAdvice')}
      </Text>
    </Screen>
  );
}
