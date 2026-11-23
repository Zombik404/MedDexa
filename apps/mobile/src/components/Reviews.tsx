import type { ReviewPage, ReviewView } from '@meddexa/shared';
import { useRouter } from 'expo-router';
import { Flag, ThumbsUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useReviewActions, useReviews, useSignedIn } from '@/api/hooks';
import { Button, Text } from '@/components/ui';
import { Stars } from '@/components/ui/Stars';
import { useToast } from '@/components/ui/Toast';
import { formatDate, flag } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

function Distribution({ stats }: { stats: ReviewPage['stats'] }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'center' }}>
      <View style={{ alignItems: 'center' }}>
        <Text variant="display">{stats.average?.toFixed(1) ?? '–'}</Text>
        <Stars value={stats.average ?? 0} />
        <Text variant="small" color="textSecondary" style={{ marginTop: 4 }}>
          {t('reviews.count', { count: stats.count })}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        {(['5', '4', '3', '2', '1'] as const).map((k) => {
          const n = stats.distribution[k];
          const pct = stats.count ? n / stats.count : 0;
          return (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="small" color="textSecondary" style={{ width: 10 }}>
                {k}
              </Text>
              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
                <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: colors.warning }} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ReviewItem({ review }: { review: ReviewView }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const signedIn = useSignedIn();
  const { helpful, report } = useReviewActions();
  const toast = useToast();
  const router = useRouter();
  const requireAuth = (fn: () => void) => (signedIn ? fn() : router.push('/auth/login'));
  return (
    <View style={{ paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stars value={review.rating} />
        <Text variant="small" color="textTertiary">
          {review.countryCode ? `${flag(review.countryCode)} ` : ''}
          {formatDate(review.createdAt)}
        </Text>
      </View>
      {review.title ? <Text variant="bodyStrong">{review.title}</Text> : null}
      <Text variant="body">{review.body}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="small" color="textSecondary">
          {review.authorName} · {review.language.toUpperCase()}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <Pressable accessibilityRole="button" onPress={() => requireAuth(() => helpful.mutate(review.id))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ThumbsUp size={14} color={review.votedHelpful ? colors.primary : colors.textSecondary} fill={review.votedHelpful ? colors.primarySoft : 'transparent'} />
            <Text variant="small" color={review.votedHelpful ? 'primary' : 'textSecondary'}>
              {t('reviews.helpful', { count: review.helpfulCount })}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('reviews.report')}
            onPress={() => requireAuth(() => report.mutate({ reviewId: review.id, reason: 'OTHER' }, { onSuccess: () => toast(t('reviews.reported')) }))}
          >
            <Flag size={14} color={colors.textTertiary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function ReviewsBlock({ target, id, name }: { target: 'medicines' | 'pharmacies'; id: string; name: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const signedIn = useSignedIn();
  const q = useReviews(target, id);
  const first = q.data?.pages[0];
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <View style={{ gap: spacing.md }}>
      {first && first.stats.count > 0 ? <Distribution stats={first.stats} /> : <Text color="textSecondary">{t('reviews.empty')}</Text>}
      {target === 'medicines' ? (
        <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}>
          <Text variant="small" color="textSecondary">
            {t('reviews.notEvidence')}
          </Text>
        </View>
      ) : null}
      <Button
        label={signedIn ? t('reviews.write') : t('reviews.signIn')}
        variant="secondary"
        size="sm"
        onPress={() => (signedIn ? router.push({ pathname: '/review/new', params: { target, id, name } }) : router.push('/auth/login'))}
      />
      <View>
        {items.map((r) => (
          <ReviewItem key={r.id} review={r} />
        ))}
      </View>
      {q.hasNextPage ? <Button label={t('common.loadMore')} variant="ghost" size="sm" onPress={() => q.fetchNextPage()} loading={q.isFetchingNextPage} /> : null}
    </View>
  );
}
