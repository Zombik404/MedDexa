import type { ScanLookupResponse } from '@meddexa/shared';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { Camera, Flashlight, Keyboard, ScanBarcode, Search, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScanLookup } from '@/api/hooks';
import { MedicineCard } from '@/components/medicine/MedicineCard';
import { Button, ErrorState, IconButton, Text, TextField } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius, spacing } from '@/theme/tokens';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'datamatrix', 'code39', 'code128', 'itf14'] as const;

/**
 * Barcode / DataMatrix scanner. One match opens the product directly; several are listed;
 * none offers the two other ways to search. Codes can also be typed.
 */
export default function ScanScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState(Platform.OS === 'web');
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<ScanLookupResponse | null>(null);
  const busy = useRef(false);
  const lookup = useScanLookup();

  // Ask for the camera straight away the first time; the explanation stays on screen otherwise.
  useEffect(() => {
    if (Platform.OS !== 'web' && permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const find = async (code: string) => {
    if (busy.current || !code.trim()) return;
    busy.current = true;
    try {
      const r = await lookup.mutateAsync(code.trim());
      if (r.matches.length === 1) {
        if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace(`/medicine/${r.matches[0]!.id}`);
        return;
      }
      setResult(r);
    } catch {
      // Shown through lookup.error.
    } finally {
      busy.current = false;
    }
  };

  const onScanned = (e: BarcodeScanningResult) => {
    if (result || lookup.isPending) return;
    void find(e.data || e.raw || '');
  };

  const reset = () => {
    setResult(null);
    lookup.reset();
  };

  const cameraReady = !manual && permission?.granted;

  return (
    <View style={{ flex: 1, backgroundColor: cameraReady ? '#000' : colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      {cameraReady && !result ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={lookup.isPending ? undefined : onScanned}
        />
      ) : null}

      {/* Top bar */}
      <View style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton testID="scan-close" icon={X} label={t('common.close')} onPress={() => router.back()} />
        {cameraReady && !result ? <IconButton icon={Flashlight} label={t('scan.torch')} active={torch} onPress={() => setTorch(!torch)} /> : null}
      </View>

      {cameraReady && !result ? (
        <>
          {/* Aiming frame */}
          <View pointerEvents="none" style={{ position: 'absolute', top: '28%', left: '10%', right: '10%', height: 180, borderRadius: radius.xl, borderWidth: 3, borderColor: palette.mint400 }} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md, backgroundColor: 'rgba(0,0,0,0.55)' }}>
            <Text variant="h3" style={{ color: '#FFFFFF' }} align="center">
              {lookup.isPending ? t('scan.searching') : t('scan.aim')}
            </Text>
            <Button label={t('scan.typeCode')} icon={Keyboard} variant="onDark" onPress={() => setManual(true)} />
          </View>
        </>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + 72, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          {result ? (
            result.matches.length ? (
              <>
                <Text variant="h2" accessibilityRole="header">
                  {t('scan.severalTitle')}
                </Text>
                {result.matches.map((m) => (
                  <MedicineCard key={m.id} medicine={m} />
                ))}
                <Button label={t('scan.again')} icon={ScanBarcode} variant="secondary" onPress={reset} />
              </>
            ) : (
              <>
                <ScanBarcode size={44} color={colors.textTertiary} />
                <Text variant="h2" accessibilityRole="header">
                  {t('scan.notFoundTitle')}
                </Text>
                <Text color="textSecondary">{t('scan.notFoundBody')}</Text>
                <Button testID="scan-try-photo" label={t('photo.title')} icon={Camera} onPress={() => router.replace('/photo')} />
                <Button label={t('scan.searchByName')} icon={Search} variant="secondary" onPress={() => router.replace({ pathname: '/search', params: { focus: String(Date.now()) } })} />
                <Button label={t('scan.again')} variant="ghost" onPress={reset} />
              </>
            )
          ) : (
            <>
              <Text variant="h1" accessibilityRole="header">
                {t('scan.title')}
              </Text>
              {!manual && permission && !permission.granted ? (
                <View style={{ gap: spacing.md }}>
                  <Text color="textSecondary">{t('scan.permission')}</Text>
                  <Button testID="scan-allow-camera" label={t('scan.allowCamera')} icon={Camera} onPress={() => void requestPermission()} />
                </View>
              ) : null}
              <Text color="textSecondary">{t('scan.manualHint')}</Text>
              <TextField
                testID="scan-code-input"
                label={t('scan.codeLabel')}
                value={typed}
                onChangeText={setTyped}
                keyboardType="number-pad"
                returnKeyType="search"
                onSubmitEditing={() => void find(typed)}
              />
              <Button testID="scan-find" label={t('scan.find')} icon={Search} loading={lookup.isPending} disabled={typed.trim().length < 6} onPress={() => void find(typed)} />
              {lookup.error ? <ErrorState error={lookup.error} compact /> : null}
              {Platform.OS !== 'web' && manual ? <Button label={t('scan.useCamera')} icon={ScanBarcode} variant="ghost" onPress={() => setManual(false)} /> : null}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
