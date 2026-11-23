import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useCreateReview } from '@/api/hooks';
import { Screen } from '@/components/Screen';
import { Button, StarInput, Text, TextField } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import i18n from '@/i18n';
import { apiErrorMessage } from '@/lib/forms';
import { usePreferences } from '@/store/preferences';
import { spacing } from '@/theme/tokens';

const SUB = ['staffRating', 'serviceRating', 'waitingRating', 'cleanlinessRating', 'accessibilityRating'] as const;
const SUB_LABEL = { staffRating: 'staff', serviceRating: 'service', waitingRating: 'waiting', cleanlinessRating: 'cleanliness', accessibilityRating: 'accessibility' } as const;

export default function NewReview() {
  const { target, id, name } = useLocalSearchParams<{ target: 'medicines' | 'pharmacies'; id: string; name: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const country = usePreferences((s) => s.countryCode);
  const create = useCreateReview(target, id);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sub, setSub] = useState<Partial<Record<(typeof SUB)[number], number>>>({});
  const tooShort = body.trim().length > 0 && body.trim().length < 20;

  const submit = async () => {
    const res = await create.mutateAsync({ rating, title: title || undefined, body: body.trim(), language: i18n.language.slice(0, 2), countryCode: country ?? undefined, ...(target === 'pharmacies' ? sub : {}) });
    toast(res.status === 'PUBLISHED' ? t('reviews.published') : t('reviews.pending'));
    router.back();
  };

  return (
    <Screen topInset={false}>
      <View style={{ gap: spacing.xl }}>
        <Text variant="h2">{name}</Text>
        <View style={{ gap: spacing.sm }}>
          <Text variant="bodyStrong">{t('reviews.overall')}</Text>
          <StarInput value={rating} onChange={setRating} label={t('reviews.overall')} />
        </View>
        {target === 'pharmacies'
          ? SUB.map((k) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text>{t(`reviews.${SUB_LABEL[k]}`)}</Text>
                <StarInput size={22} value={sub[k] ?? 0} onChange={(v) => setSub({ ...sub, [k]: v })} label={t(`reviews.${SUB_LABEL[k]}`)} />
              </View>
            ))
          : null}
        <TextField label={t('reviews.titleField')} value={title} onChangeText={setTitle} maxLength={120} />
        <TextField label={t('reviews.bodyField')} value={body} onChangeText={setBody} multiline maxLength={2000} hint={t('reviews.bodyHint')} error={tooShort ? t('reviews.errors.tooShort') : undefined} />
        {target === 'medicines' ? (
          <Text variant="small" color="textSecondary">
            {t('reviews.notEvidence')}
          </Text>
        ) : null}
        {create.error ? <Text color="danger">{apiErrorMessage(t, create.error)}</Text> : null}
        <Button label={t('reviews.submit')} onPress={submit} loading={create.isPending} disabled={!rating || body.trim().length < 20} full />
      </View>
    </Screen>
  );
}
