import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Bell, BellRing } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { api } from '@/api/client';
import { useProfile, useSignedIn, useUpdatePreferences } from '@/api/hooks';
import { Screen } from '@/components/Screen';
import { EmptyState, Text } from '@/components/ui';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { spacing } from '@/theme/tokens';

/** Registers this device for push notifications (Expo push → FCM / APNs). */
async function registerPush() {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api('/me/push-tokens', { method: 'POST', auth: true, body: { token, platform: Platform.OS } });
}

export default function NotificationSettings() {
  const { t } = useTranslation();
  const signedIn = useSignedIn();
  const profile = useProfile();
  const update = useUpdatePreferences();
  if (!signedIn) return <Screen topInset={false}><EmptyState icon={Bell} title={t('profile.notifications')} body={t('profile.guestBody')} /></Screen>;
  const p = profile.data?.preferences;
  const set = (patch: { notifyPriceChanges?: boolean; notifyProductUpdates?: boolean }) => {
    update.mutate(patch);
    if (Object.values(patch).some(Boolean)) void registerPush();
  };
  return (
    <Screen topInset={false}>
      <ListGroup>
        <ListRow icon={BellRing} title={t('profile.notifyPrices')} toggle={{ value: !!p?.notifyPriceChanges, onChange: (v) => set({ notifyPriceChanges: v }) }} />
        <ListRow icon={Bell} title={t('profile.notifyProducts')} toggle={{ value: !!p?.notifyProductUpdates, onChange: (v) => set({ notifyProductUpdates: v }) }} last />
      </ListGroup>
      <View style={{ marginTop: spacing.lg }}>
        <Text variant="small" color="textSecondary">
          {t('prices.notPurchase')}
        </Text>
      </View>
    </Screen>
  );
}
