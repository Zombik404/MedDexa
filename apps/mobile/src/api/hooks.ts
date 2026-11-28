import { useTranslation } from 'react-i18next';
import type {
  CategoryView,
  IngredientNames,
  FilterOption,
  FilterOptionField,
  IngredientHit,
  PhotoSearchResponse,
  ScanLookupResponse,
  AuthTokens,
  CompareResponse,
  ComparisonHistoryView,
  FavoriteView,
  LoginInput,
  MedicineDetail,
  MedicineReviewInput,
  MedicineSearchQuery,
  MedicineSummary,
  MetaView,
  NotificationView,
  Paged,
  PharmacyDetail,
  PharmacyReviewInput,
  PharmacySearchQuery,
  PharmacySummary,
  PreferencesInput,
  PreferencesView,
  PriceComparisonView,
  RegisterInput,
  ReviewPage,
  SearchHistoryView,
  SimilarMedicine,
  Suggestion,
  AuthUser,
} from '@meddexa/shared';
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePreferences } from '@/store/preferences';
import { useSession } from '@/store/session';
import { useDebounced } from '@/hooks/useDebounced';
import { api, apiUploadImage } from './client';

export const useCurrency = () => usePreferences((s) => s.currency);
export const useSignedIn = () => useSession((s) => !!s.user && !!s.refreshToken);

type SearchParams = Partial<Omit<MedicineSearchQuery, 'page'>>;

export function useMedicineSearch(params: SearchParams, enabled = true) {
  const currency = useCurrency();
  return useInfiniteQuery({
    queryKey: ['medicines', 'search', params, currency],
    queryFn: ({ pageParam, signal }) =>
      api<Paged<MedicineSummary>>('/medicines/search', { query: { ...params, currency, page: pageParam, pageSize: 20 } as never, signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useSuggestions(q: string) {
  return useQuery({
    queryKey: ['suggest', q],
    queryFn: ({ signal }) => api<Suggestion[]>('/medicines/suggest', { query: { q }, signal }),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  });
}

export function usePopularMedicines() {
  const currency = useCurrency();
  return useQuery({ queryKey: ['medicines', 'popular', currency], queryFn: () => api<MedicineSummary[]>('/medicines/popular', { query: { currency } }), staleTime: 5 * 60_000 });
}

export function usePopularSearches() {
  return useQuery({ queryKey: ['medicines', 'popular-searches'], queryFn: () => api<string[]>('/medicines/popular-searches'), staleTime: 10 * 60_000 });
}

export function useCategories() {
  return useQuery({ queryKey: ['medicines', 'categories'], queryFn: () => api<CategoryView[]>('/medicines/categories'), staleTime: 30 * 60_000 });
}

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => api<MetaView>('/meta'), staleTime: 60 * 60_000 });
}

export function useMedicine(id: string | undefined) {
  const currency = useCurrency();
  return useQuery({ queryKey: ['medicine', id, currency], queryFn: () => api<MedicineDetail>(`/medicines/${id}`, { query: { currency } }), enabled: !!id });
}

export function useMedicinesByIds(ids: string[]) {
  const currency = useCurrency();
  return useQuery({
    queryKey: ['medicines', 'byIds', ids, currency],
    queryFn: async () => Promise.all(ids.map((id) => api<MedicineDetail>(`/medicines/${id}`, { query: { currency } }))),
    enabled: ids.length > 0,
  });
}

export function usePrices(id: string | undefined, country?: string) {
  const currency = useCurrency();
  return useQuery({
    queryKey: ['prices', id, currency, country],
    queryFn: () => api<PriceComparisonView>(`/medicines/${id}/prices`, { query: { currency, country } }),
    enabled: !!id,
  });
}

export function useSimilar(id: string | undefined) {
  const currency = useCurrency();
  return useQuery({ queryKey: ['similar', id, currency], queryFn: () => api<SimilarMedicine[]>(`/medicines/${id}/similar`, { query: { currency } }), enabled: !!id });
}

export function useCompareQuery(ids: string[]) {
  const currency = useCurrency();
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: ['compare', ids, currency, signedIn],
    queryFn: () => api<CompareResponse>('/compare', { method: 'POST', body: { medicineIds: ids, currency }, query: { save: signedIn ? 'true' : 'false' } }),
    enabled: ids.length >= 2,
    staleTime: 60_000,
  });
}

export function usePharmacySearch(params: Partial<Omit<PharmacySearchQuery, 'page'>>, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['pharmacies', params],
    queryFn: ({ pageParam, signal }) => api<Paged<PharmacySummary>>('/pharmacies', { query: { ...params, page: pageParam, pageSize: 30 } as never, signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function usePharmacy(id: string | undefined, coords?: { lat: number; lng: number } | null) {
  return useQuery({
    queryKey: ['pharmacy', id, coords?.lat?.toFixed(3), coords?.lng?.toFixed(3)],
    queryFn: () => api<PharmacyDetail>(`/pharmacies/${id}`, { query: { lat: coords?.lat, lng: coords?.lng } }),
    enabled: !!id,
  });
}

export function useReviews(target: 'medicines' | 'pharmacies', id: string | undefined, sort: 'recent' | 'helpful' = 'recent') {
  return useInfiniteQuery({
    queryKey: ['reviews', target, id, sort],
    queryFn: ({ pageParam }) => api<ReviewPage>(`/${target}/${id}/reviews`, { query: { page: pageParam, pageSize: 10, sort } }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!id,
  });
}

export function useCreateReview(target: 'medicines' | 'pharmacies', id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MedicineReviewInput | PharmacyReviewInput) => api<{ id: string; status: string }>(`/${target}/${id}/reviews`, { method: 'POST', body, auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews', target, id] }),
  });
}

export function useReviewActions() {
  const qc = useQueryClient();
  return {
    helpful: useMutation({
      mutationFn: (reviewId: string) => api<{ voted: boolean }>(`/reviews/${reviewId}/helpful`, { method: 'POST', auth: true }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews'] }),
    }),
    report: useMutation({
      mutationFn: (v: { reviewId: string; reason: string }) => api(`/reviews/${v.reviewId}/report`, { method: 'POST', body: { reason: v.reason }, auth: true }),
    }),
  };
}

// ───────── Account ─────────

export function useAuthMutations() {
  const setTokens = useSession((s) => s.setTokens);
  const qc = useQueryClient();
  const after = async (t: AuthTokens) => {
    await setTokens(t);
    await qc.invalidateQueries();
  };
  return {
    login: useMutation({ mutationFn: (b: LoginInput) => api<AuthTokens>('/auth/login', { method: 'POST', body: b }), onSuccess: after }),
    register: useMutation({ mutationFn: (b: RegisterInput) => api<AuthTokens>('/auth/register', { method: 'POST', body: b }), onSuccess: after }),
    forgot: useMutation({ mutationFn: (email: string) => api('/auth/forgot-password', { method: 'POST', body: { email } }) }),
  };
}

export function useLogout() {
  const qc = useQueryClient();
  const { refreshToken, clear } = useSession.getState();
  return async () => {
    if (refreshToken) await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
    await clear();
    qc.removeQueries({ queryKey: ['me'] });
  };
}

export function useProfile() {
  const signedIn = useSignedIn();
  return useQuery({ queryKey: ['me'], queryFn: () => api<{ user: AuthUser; preferences: PreferencesView }>('/me', { auth: true }), enabled: signedIn });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: PreferencesInput) => api<PreferencesView>('/me/preferences', { method: 'PATCH', body: p, auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const setUser = useSession((s) => s.setUser);
  return useMutation({
    mutationFn: (p: { displayName: string | null }) => api<AuthUser>('/me', { method: 'PATCH', body: p, auth: true }),
    onSuccess: (u) => {
      setUser(u);
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useFavorites() {
  const signedIn = useSignedIn();
  const currency = useCurrency();
  return useQuery({ queryKey: ['me', 'favorites', currency], queryFn: () => api<FavoriteView[]>('/me/favorites', { auth: true, query: { currency } }), enabled: signedIn });
}

export function useFavoriteMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ['me', 'favorites'] });
  return {
    add: useMutation({ mutationFn: (t: { medicineId?: string; pharmacyId?: string }) => api('/me/favorites', { method: 'POST', body: t, auth: true }), onSuccess: done }),
    remove: useMutation({ mutationFn: (t: { medicineId?: string; pharmacyId?: string }) => api('/me/favorites', { method: 'DELETE', query: t, auth: true }), onSuccess: done }),
  };
}

export function useSearchHistory() {
  const signedIn = useSignedIn();
  return useQuery({ queryKey: ['me', 'search-history'], queryFn: () => api<SearchHistoryView[]>('/me/search-history', { auth: true }), enabled: signedIn });
}

export function useComparisonHistory() {
  const signedIn = useSignedIn();
  return useQuery({ queryKey: ['me', 'comparisons'], queryFn: () => api<ComparisonHistoryView[]>('/me/comparisons', { auth: true }), enabled: signedIn });
}

export function useRecentlyViewed() {
  const signedIn = useSignedIn();
  const currency = useCurrency();
  return useQuery({
    queryKey: ['me', 'recently-viewed', currency],
    queryFn: () => api<{ medicines: MedicineSummary[]; pharmacies: PharmacySummary[] }>('/me/recently-viewed', { auth: true, query: { currency } }),
    enabled: signedIn,
  });
}

export function useNotifications() {
  const signedIn = useSignedIn();
  return useQuery({ queryKey: ['me', 'notifications'], queryFn: () => api<NotificationView[]>('/me/notifications', { auth: true }), enabled: signedIn });
}

export function useHistoryMutations() {
  const qc = useQueryClient();
  return {
    clearSearches: useMutation({ mutationFn: () => api('/me/search-history', { method: 'DELETE', auth: true }), onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'search-history'] }) }),
    clearComparisons: useMutation({ mutationFn: () => api('/me/comparisons', { method: 'DELETE', auth: true }), onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'comparisons'] }) }),
    clearRecent: useMutation({ mutationFn: () => api('/me/recently-viewed', { method: 'DELETE', auth: true }), onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'recently-viewed'] }) }),
  };
}

export function useAccountActions() {
  return {
    exportData: useMutation({ mutationFn: () => api<unknown>('/me/export', { auth: true }) }),
    deleteAccount: useMutation({ mutationFn: (password: string) => api('/me/delete', { method: 'POST', body: { password }, auth: true }) }),
  };
}

export function useIngredientSearch(q: string) {
  return useQuery({
    queryKey: ['ingredients', 'search', q],
    queryFn: ({ signal }) => api<IngredientHit[]>('/ingredients/search', { query: { q }, signal }),
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60_000,
  });
}

/** Barcode / DataMatrix / typed pack code → products. */
export function useScanLookup() {
  const currency = useCurrency();
  return useMutation({ mutationFn: (code: string) => api<ScanLookupResponse>('/medicines/scan', { query: { code, currency } }) });
}

/** Photo of a box → products (the server reads the printed text; the photo is not stored). */
export function usePhotoSearch() {
  const currency = useCurrency();
  return useMutation({
    mutationFn: (image: { uri: string; mimeType?: string | null }) => apiUploadImage<PhotoSearchResponse>('/medicines/photo', image, { currency }),
  });
}

/** Type-ahead values for a search filter; runs while the field is focused. */
export function useFilterOptions(field: FilterOptionField, q: string, enabled: boolean) {
  const debounced = useDebounced(q, 150);
  return useQuery({
    queryKey: ['filter-options', field, debounced],
    queryFn: ({ signal }) => api<FilterOption[]>('/medicines/filter-options', { query: { field, q: debounced }, signal }),
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

/** Ingredient names in the app language (empty for English, where the catalogue names are used). */
export function useIngredientNames() {
  const { i18n } = useTranslation();
  const lang = i18n.language.slice(0, 2);
  return useQuery({
    queryKey: ['ingredients', 'names', lang],
    queryFn: () => api<IngredientNames>('/ingredients/names', { query: { lang } }),
    enabled: lang !== 'en',
    staleTime: 60 * 60_000,
  });
}
