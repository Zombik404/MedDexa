import * as Location from 'expo-location';
import { useCallback, useEffect } from 'react';
import { create } from 'zustand';

type Status = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

interface LocationState {
  status: Status;
  coords: { lat: number; lng: number } | null;
  city: string | null;
  set: (p: Partial<LocationState>) => void;
}

/** In-memory only: the user's position is never persisted or sent except as a search parameter. */
const useLocationStore = create<LocationState>((set) => ({ status: 'idle', coords: null, city: null, set: (p) => set(p) }));

export function useLocation(autoRequest = false) {
  const state = useLocationStore();

  const locate = useCallback(async (ask: boolean) => {
    const s = useLocationStore.getState();
    try {
      s.set({ status: 'locating' });
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && ask && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return s.set({ status: 'denied' });
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      s.set({ status: 'granted', coords });
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
        s.set({ city: place?.city ?? place?.subregion ?? null });
      } catch {
        // Reverse geocoding is optional.
      }
    } catch {
      s.set({ status: 'unavailable' });
    }
  }, []);

  useEffect(() => {
    if (autoRequest && useLocationStore.getState().status === 'idle') void locate(false);
  }, [autoRequest, locate]);

  return { ...state, request: () => locate(true) };
}
