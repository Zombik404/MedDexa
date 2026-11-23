import type { PharmacySummary } from '@meddexa/shared';
import { AdapterConfigurationError, type DataAdapter } from '../adapter';

export interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  addressComponents?: { shortText: string; types: string[] }[];
}

export function mapGooglePlace(p: GooglePlace, distanceKm: number | null): PharmacySummary | null {
  if (!p.location || !p.displayName?.text) return null;
  const country = p.addressComponents?.find((c) => c.types.includes('country'))?.shortText ?? '';
  const city = p.addressComponents?.find((c) => c.types.includes('locality'))?.shortText ?? null;
  const postcode = p.addressComponents?.find((c) => c.types.includes('postal_code'))?.shortText ?? null;
  return {
    id: `gplaces:${p.id}`,
    name: p.displayName.text,
    address: p.formattedAddress ?? '',
    city,
    postcode,
    countryCode: country,
    lat: p.location.latitude,
    lng: p.location.longitude,
    distanceKm,
    openNow: null,
    rating: null,
    verified: false,
    isDemo: false,
  };
}

/**
 * Google Places API (New). The Google Maps Platform terms do not allow storing Places
 * content beyond place IDs, so this provider is on-demand only: results are fetched live
 * for the user's map and never written to the database.
 */
export async function googleNearbyPharmacies(
  apiKey: string | undefined,
  lat: number,
  lng: number,
  radiusMeters: number,
  fetchImpl: typeof fetch = fetch,
): Promise<GooglePlace[]> {
  if (!apiKey) throw new AdapterConfigurationError('GOOGLE_MAPS_API_KEY is not configured');
  const res = await fetchImpl('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents',
    },
    body: JSON.stringify({
      includedTypes: ['pharmacy'],
      maxResultCount: 20,
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radiusMeters, 50_000) } },
    }),
  });
  if (!res.ok) throw new Error(`Google Places responded ${res.status}`);
  const json = (await res.json()) as { places?: GooglePlace[] };
  return json.places ?? [];
}

export const googlePlacesAdapter: DataAdapter = {
  key: 'google-places',
  requiredEnv: ['GOOGLE_MAPS_API_KEY'],
  onDemandOnly: true,
  async sync() {
    throw new AdapterConfigurationError('Google Places is an on-demand provider; bulk synchronisation is not permitted by its terms.');
  },
};
