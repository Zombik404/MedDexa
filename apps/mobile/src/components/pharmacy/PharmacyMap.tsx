import type { PharmacySummary } from '@meddexa/shared';
import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius } from '@/theme/tokens';

interface Props {
  pharmacies: PharmacySummary[];
  center: { lat: number; lng: number } | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRegionChange?: (c: { lat: number; lng: number; radiusKm: number }) => void;
  showsUser?: boolean;
}

/**
 * Native map: Apple Maps on iOS (no key needed), Google Maps on Android (key from
 * GOOGLE_MAPS_ANDROID_API_KEY). Markers are plain views for fast rendering.
 */
export default function PharmacyMap({ pharmacies, center, selectedId, onSelect, onRegionChange, showsUser }: Props) {
  const ref = useRef<MapView>(null);
  const { dark } = useTheme();
  useEffect(() => {
    if (center) ref.current?.animateToRegion({ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.06, longitudeDelta: 0.06 }, 350);
  }, [center?.lat, center?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MapView
      ref={ref}
      style={{ flex: 1 }}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
      userInterfaceStyle={dark ? 'dark' : 'light'}
      showsUserLocation={showsUser}
      showsPointsOfInterests={false}
      initialRegion={{ latitude: center?.lat ?? 48.2, longitude: center?.lng ?? 16.37, latitudeDelta: center ? 0.06 : 12, longitudeDelta: center ? 0.06 : 12 }}
      onRegionChangeComplete={(r) => onRegionChange?.({ lat: r.latitude, lng: r.longitude, radiusKm: Math.min(200, Math.max(1, (r.latitudeDelta * 111) / 2)) })}
    >
      {pharmacies.map((p) => {
        const selected = p.id === selectedId;
        return (
          <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} onPress={() => onSelect(p.id)} tracksViewChanges={false} accessibilityLabel={p.name}>
            <View style={{ width: selected ? 30 : 22, height: selected ? 30 : 22, borderRadius: radius.pill, backgroundColor: selected ? palette.mint400 : palette.forest800, borderWidth: 3, borderColor: '#FFFFFF' }} />
          </Marker>
        );
      })}
    </MapView>
  );
}
