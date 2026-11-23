import type { PhotoSearchResponse } from '@meddexa/shared';
import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { Camera, Images, Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import { usePhotoSearch } from '@/api/hooks';
import { MedicineCard } from '@/components/medicine/MedicineCard';
import { Button, ErrorState, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** Large photos are scaled down on the device: faster upload, same text recognition. */
async function prepare(asset: ImagePicker.ImagePickerAsset) {
  if (Platform.OS === 'web' || (asset.width && asset.width <= 1600)) return { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
  const out = await manipulateAsync(asset.uri, [{ resize: { width: 1600 } }], { compress: 0.8, format: SaveFormat.JPEG });
  return { uri: out.uri, mimeType: 'image/jpeg' };
}

export default function PhotoSearchScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const search = usePhotoSearch();
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<PhotoSearchResponse | null>(null);
  const [denied, setDenied] = useState(false);

  const pick = async (source: 'camera' | 'library') => {
    setDenied(false);
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setDenied(true);
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85, allowsEditing: false, exif: false };
    const picked = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled || !picked.assets[0]) return;
    const image = await prepare(picked.assets[0]);
    setPreview(image.uri);
    setResult(null);
    try {
      const r = await search.mutateAsync(image);
      if (r.matches.length === 1) return router.replace(`/medicine/${r.matches[0]!.id}`);
      setResult(r);
    } catch {
      // Rendered from search.error.
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl, paddingBottom: 48, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('photo.title') }} />

      {preview ? (
        <View style={{ height: 180, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
          <Image source={preview} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel={t('photo.yourPhoto')} />
          {search.isPending ? (
            <View style={{ ...StyleFill, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF' }}>{t('photo.reading')}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Camera size={40} color={colors.primary} strokeWidth={1.8} />
          </View>
          <Text variant="h2" align="center">
            {t('photo.title')}
          </Text>
          <Text color="textSecondary" align="center">
            {t('photo.tip')}
          </Text>
        </View>
      )}

      {result ? (
        result.matches.length ? (
          <View style={{ gap: spacing.md }}>
            <Text variant="h3">{t('photo.severalTitle')}</Text>
            {result.matches.map((m) => (
              <MedicineCard key={m.id} medicine={m} />
            ))}
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Text variant="h3">{t('photo.notFoundTitle')}</Text>
            <Text color="textSecondary">{t('photo.notFoundBody')}</Text>
            {result.terms.length ? (
              <Button
                label={t('photo.searchWord', { word: result.terms[0] })}
                icon={Search}
                variant="secondary"
                onPress={() => router.replace({ pathname: '/search', params: { q: result.terms[0] } })}
              />
            ) : null}
          </View>
        )
      ) : null}
      {search.error ? <ErrorState error={search.error} compact /> : null}
      {denied ? <Text color="warning">{t('photo.cameraDenied')}</Text> : null}

      <Button testID="photo-camera" label={preview ? t('photo.retake') : t('photo.takePhoto')} icon={Camera} loading={search.isPending} onPress={() => void pick('camera')} />
      <Button testID="photo-library" label={t('photo.fromGallery')} icon={Images} variant="secondary" disabled={search.isPending} onPress={() => void pick('library')} />
      <Text variant="small" color="textTertiary" align="center">
        {t('photo.privacy')}
      </Text>
    </ScrollView>
  );
}

const StyleFill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
