import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useUpdateProfile } from '@/api/hooks';
import { Screen } from '@/components/Screen';
import { Button, Text, TextField } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/store/session';
import { spacing } from '@/theme/tokens';

export default function Account() {
  const { t } = useTranslation();
  const toast = useToast();
  const user = useSession((s) => s.user);
  const update = useUpdateProfile();
  const [name, setName] = useState(user?.displayName ?? '');
  return (
    <Screen topInset={false}>
      <View style={{ gap: spacing.xl }}>
        <TextField label={t('auth.displayName')} value={name} onChangeText={setName} autoComplete="name" />
        <View style={{ gap: 4 }}>
          <Text variant="small" color="textSecondary">
            {t('auth.email')}
          </Text>
          <Text variant="bodyStrong">{user?.email}</Text>
        </View>
        <Button label={t('common.save')} loading={update.isPending} onPress={() => update.mutate({ displayName: name.trim() || null }, { onSuccess: () => toast(t('common.done')) })} full />
      </View>
    </Screen>
  );
}
