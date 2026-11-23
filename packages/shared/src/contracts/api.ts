import type { CodeSystem, ParsedScan } from '../barcode';
import type {
  ComparisonResult,
  CompositionClass,
  PrescriptionStatus,
  ReleaseMechanism,
} from '../comparison/types';

/** Response contracts of the MedDexa REST API (v1). */

export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'OUTDATED' | 'DEMO';

export interface Provenance {
  sourceId: string;
  sourceName: string;
  sourceReference: string | null;
  countryCode: string | null;
  syncedAt: string | null;
  verification: VerificationStatus;
  confidence: number | null;
  /** True for explicitly labelled development data. */
  isDemo: boolean;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface IngredientView {
  substanceId: string;
  substanceName: string;
  moietyId: string | null;
  moietyName: string | null;
  amount: number | null;
  unit: string | null;
  perAmount: number | null;
  perUnit: string | null;
  basis: 'SUBSTANCE' | 'MOIETY';
  display: string | null;
}

export interface MedicineSummary {
  id: string;
  name: string;
  brand: string | null;
  manufacturer: string | null;
  countryCode: string | null;
  atcCode: string | null;
  form: { code: string; name: string; group: string | null } | null;
  route: string | null;
  release: ReleaseMechanism | null;
  prescription: PrescriptionStatus;
  packageSize: { quantity: number; unit: string } | null;
  ingredients: IngredientView[];
  /** Official product photo (packaging) when a source publishes one; otherwise null. */
  imageUrl: string | null;
  /** Attribution required by the photo's source, e.g. "AEMPS · CIMA". */
  imageCredit: string | null;
  rating: { average: number; count: number } | null;
  /** Lowest verified price in the requested currency, when any exists. */
  lowestPrice: (Money & { converted: boolean; countryCode: string }) | null;
  isDemo: boolean;
}

export interface RegistrationView {
  id: string;
  countryCode: string;
  authority: string;
  registrationNumber: string | null;
  localName: string;
  status: 'AUTHORISED' | 'SUSPENDED' | 'WITHDRAWN' | 'UNKNOWN';
  authorisedAt: string | null;
  provenance: Provenance;
}

export interface DocumentView {
  id: string;
  kind: 'SMPC' | 'PIL' | 'EPAR' | 'LABEL' | 'OTHER';
  title: string;
  language: string;
  countryCode: string | null;
  url: string;
  provenance: Provenance;
}

export interface SafetySectionView {
  kind: 'WARNINGS' | 'CONTRAINDICATIONS' | 'SIDE_EFFECTS' | 'DOSAGE';
  language: string;
  countryCode: string | null;
  content: string;
  provenance: Provenance;
}

export interface MedicineDetail extends MedicineSummary {
  synonyms: { name: string; language: string | null; countryCode: string | null }[];
  barcodes: string[];
  /** Pack identifiers from official sources (GTIN, national codes). */
  codes: { system: CodeSystem; code: string; countryCode: string | null }[];
  registrations: RegistrationView[];
  documents: DocumentView[];
  safety: SafetySectionView[];
  provenance: Provenance;
  updatedAt: string;
}

export interface SimilarMedicine {
  medicine: MedicineSummary;
  composition: CompositionClass;
}

export interface Suggestion {
  type: 'medicine' | 'ingredient' | 'manufacturer' | 'atc';
  id: string;
  label: string;
  secondary: string | null;
}

export type AvailabilityStatus = 'IN_STOCK' | 'LIMITED' | 'OUT_OF_STOCK' | 'UNKNOWN';

export interface PriceOfferView {
  id: string;
  medicineId: string;
  pharmacy: { id: string; name: string; city: string | null; countryCode: string } | null;
  countryCode: string;
  local: Money;
  /** Present when the user's currency differs from the local currency. Estimate only. */
  converted: (Money & { rateDate: string; rateSource: string }) | null;
  packageSize: { quantity: number; unit: string } | null;
  perUnit: { amount: number; currency: string; per: string } | null;
  priceType: 'RETAIL' | 'MAX_RETAIL' | 'REIMBURSEMENT_REFERENCE';
  availability: AvailabilityStatus;
  availabilityUpdatedAt: string | null;
  observedAt: string;
  stale: boolean;
  provenance: Provenance;
}

export interface PriceComparisonView {
  medicineId: string;
  currency: string;
  offers: PriceOfferView[];
  countriesWithoutData: string[];
  rates: { date: string; source: string; isFallback: boolean } | null;
  history: { date: string; countryCode: string; amount: number; currency: string }[];
}

export interface CompareResponse {
  medicines: MedicineSummary[];
  result: ComparisonResult;
  prices: Record<string, PriceOfferView | null>;
}

export interface OpeningHoursView {
  /** 0 = Monday … 6 = Sunday */
  day: number;
  opens: string;
  closes: string;
}

export interface PharmacySummary {
  id: string;
  name: string;
  address: string;
  city: string | null;
  postcode: string | null;
  countryCode: string;
  lat: number;
  lng: number;
  distanceKm: number | null;
  openNow: boolean | null;
  rating: { average: number; count: number } | null;
  verified: boolean;
  isDemo: boolean;
}

export interface PharmacyDetail extends PharmacySummary {
  phone: string | null;
  phoneVerified: boolean;
  website: string | null;
  websiteVerified: boolean;
  email: string | null;
  openingHours: OpeningHoursView[];
  services: { code: string; name: string }[];
  ratingBreakdown: {
    staff: number | null;
    service: number | null;
    waiting: number | null;
    cleanliness: number | null;
    accessibility: number | null;
  } | null;
  offersCount: number;
  provenance: Provenance;
  updatedAt: string;
}

export interface ReviewView {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  language: string;
  countryCode: string | null;
  authorName: string;
  createdAt: string;
  helpfulCount: number;
  votedHelpful: boolean;
  subRatings?: Record<string, number | null>;
}

export interface ReviewStats {
  average: number | null;
  count: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface ReviewPage extends Paged<ReviewView> {
  stats: ReviewStats;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'USER' | 'MODERATOR' | 'EDITOR' | 'ADMIN';
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface PreferencesView {
  language: string;
  currency: string;
  countryCode: string | null;
  theme: 'system' | 'light' | 'dark';
  notifyPriceChanges: boolean;
  notifyProductUpdates: boolean;
  analyticsConsent: boolean;
  saveSearchHistory: boolean;
}

export interface FavoriteView {
  id: string;
  createdAt: string;
  medicine: MedicineSummary | null;
  pharmacy: PharmacySummary | null;
}

export interface SearchHistoryView {
  id: string;
  query: string;
  filters: Record<string, unknown> | null;
  resultCount: number;
  createdAt: string;
}

export interface ComparisonHistoryView {
  id: string;
  title: string | null;
  medicineIds: string[];
  medicineNames: string[];
  createdAt: string;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface MetaView {
  countries: { code: string; name: string; currency: string; supported: boolean }[];
  languages: { code: string; name: string }[];
  currencies: string[];
  forms: { code: string; name: string; group: string | null }[];
  routes: string[];
  services: { code: string; name: string }[];
  atcGroups: { code: string; name: string }[];
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
  details?: unknown;
}

export interface CategoryView {
  slug: string;
  icon: string;
  count: number;
}

export interface IngredientHit {
  id: string;
  name: string;
  /** Matching translated/alternative name, when the query hit a synonym. */
  synonym: string | null;
  medicineCount: number;
}

export interface ScanLookupResponse {
  scan: ParsedScan;
  matches: MedicineSummary[];
  /** True when the match was fetched live from an official registry for this scan. */
  fetchedFromOfficialSource: boolean;
}

export interface PhotoSearchResponse {
  /** Text lines recognised on the photo (not stored). */
  recognizedText: string[];
  /** Product-name terms that were searched. */
  terms: string[];
  matches: MedicineSummary[];
}
