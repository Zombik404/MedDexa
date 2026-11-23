import { Download, History, Smartphone, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Share, View } from 'react-native';
import { useAccountActions, useLogout, useSignedIn, useUpdatePreferences } from '@/api/hooks';
import { Screen } from '@/components/Screen';
import { Button, Sheet, Text, TextField } from '@/components/ui';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { useToast } from '@/components/ui/Toast';
import { apiErrorMessage } from '@/lib/forms';
import { useCompare } from '@/store/compare';
import { useLocal } from '@/store/local';
import { usePreferences } from '@/store/preferences';
import { spacing } from '@/theme/tokens';

export default function Privacy() {
  const { t } = useTranslation();
  const toast = useToast();
  const signedIn = useSignedIn();
  const prefs = usePreferences();
  const update = useUpdatePreferences();
  const { exportData, deleteAccount } = useAccountActions();
  const logout = useLogout();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');

  const onExport = async () => {
    const data = await exportData.mutateAsync();
    const json = JSON.stringify(data, null, 2);
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'meddexa-export.json';
      a.click();
    } else {
      await Share.share({ message: json, title: 'meddexa-export.json' });
    }
    toast(t('profile.exportDone'));
  };

  return (
    <Screen topInset={false}>
      <ListGroup>
        <ListRow
          icon={History}
          title={t('profile.saveHistory')}
          toggle={{
            value: prefs.saveSearchHistory,
            onChange: (v) => {
              prefs.set({ saveSearchHistory: v });
              if (!v) useLocal.getState().clearSearches();
              if (signedIn) update.mutate({ saveSearchHistory: v });
            },
          }}
        />
        <ListRow
          icon={Smartphone}
          title={t('profile.clearDevice')}
          onPress={() => {
            useLocal.getState().clearAll();
            useCompare.setState({ items: [], localHistory: [] });
            toast(t('common.done'));
          }}
          last={!signedIn}
        />
        {signedIn ? <ListRow icon={Download} title={t('profile.export')} onPress={() => void onExport()} last /> : null}
      </ListGroup>

      {signedIn ? (
        <View style={{ marginTop: spacing.xxl }}>
          <ListGroup>
            <ListRow icon={Trash2} title={t('profile.delete')} danger onPress={() => setDeleting(true)} last />
          </ListGroup>
        </View>
      ) : null}

      <Sheet
        visible={deleting}
        onClose={() => setDeleting(false)}
        title={t('profile.delete')}
        footer={
          <Button
            label={t('profile.delete')}
            variant="danger"
            loading={deleteAccount.isPending}
            disabled={!password}
            onPress={async () => {
              await deleteAccount.mutateAsync(password);
              setDeleting(false);
              await logout();
            }}
            full
          />
        }
      >
        <Text>{t('profile.deleteBody')}</Text>
        <TextField label={t('profile.confirmPassword')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
        {deleteAccount.error ? <Text color="danger">{apiErrorMessage(t, deleteAccount.error)}</Text> : null}
      </Sheet>
    </Screen>
  );
}
