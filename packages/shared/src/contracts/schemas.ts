import { z } from 'zod';
import { MAX_COMPARE, MIN_COMPARE } from '../comparison/engine';

/** Request schemas shared by the API (validation), mobile app and admin (forms). */

const csv = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean));

const bool = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const medicineSortValues = ['relevance', 'name', 'price_asc', 'price_desc', 'rating'] as const;

export const medicineSearchSchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  ingredients: csv.optional(),
  manufacturer: z.string().trim().max(120).optional(),
  atc: z.string().trim().toUpperCase().max(7).optional(),
  form: z.string().trim().max(60).optional(),
  route: z.string().trim().max(60).optional(),
  prescription: z.enum(['RX', 'OTC', 'PHARMACY_ONLY']).optional(),
  country: z.string().trim().length(2).toUpperCase().optional(),
  strength: z.string().trim().max(40).optional(),
  packageSize: z.coerce.number().positive().optional(),
  barcode: z.string().trim().regex(/^\d{8,14}$/).optional(),
  registrationNumber: z.string().trim().max(60).optional(),
  hasPrice: bool.optional(),
  sort: z.enum(medicineSortValues).default('relevance'),
  currency: z.string().length(3).toUpperCase().optional(),
});
export type MedicineSearchQuery = z.infer<typeof medicineSearchSchema>;

export const suggestSchema = z.object({
  q: z.string().trim().min(1).max(80),
  locale: z.string().max(10).optional(),
});

export const compareRequestSchema = z.object({
  medicineIds: z
    .array(z.string().min(1))
    .min(MIN_COMPARE)
    .max(MAX_COMPARE)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate medicines'),
  currency: z.string().length(3).toUpperCase().optional(),
});
export type CompareRequest = z.infer<typeof compareRequestSchema>;

export const pharmacySearchSchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.5).max(200).default(10),
  city: z.string().trim().max(80).optional(),
  postcode: z.string().trim().max(12).optional(),
  country: z.string().trim().length(2).toUpperCase().optional(),
  openNow: bool.optional(),
  services: csv.optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  verifiedOnly: bool.optional(),
  sort: z.enum(['distance', 'rating', 'name']).optional(),
});
export type PharmacySearchQuery = z.infer<typeof pharmacySearchSchema>;

export const passwordSchema = z
  .string()
  .min(10, 'auth.errors.passwordLength')
  .max(128)
  .regex(/[A-Za-z]/, 'auth.errors.passwordLetter')
  .regex(/\d/, 'auth.errors.passwordDigit');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('auth.errors.email'),
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(60).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'auth.errors.terms' }) }),
  locale: z.string().max(10).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('auth.errors.email'),
  password: z.string().min(1, 'auth.errors.required').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });
export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email() });
export const resetPasswordSchema = z.object({ token: z.string().min(20), password: passwordSchema });
export const deleteAccountSchema = z.object({ password: z.string().min(1).max(128) });

export const preferencesSchema = z.object({
  language: z.string().min(2).max(10).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  countryCode: z.string().length(2).toUpperCase().nullable().optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  notifyPriceChanges: z.boolean().optional(),
  notifyProductUpdates: z.boolean().optional(),
  analyticsConsent: z.boolean().optional(),
  saveSearchHistory: z.boolean().optional(),
});
export type PreferencesInput = z.infer<typeof preferencesSchema>;

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).nullable().optional(),
});

export const favoriteSchema = z
  .object({
    medicineId: z.string().optional(),
    pharmacyId: z.string().optional(),
  })
  .refine((v) => !!v.medicineId !== !!v.pharmacyId, 'Exactly one of medicineId or pharmacyId');

export const medicineReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(20, 'reviews.errors.tooShort').max(2000),
  language: z.string().min(2).max(10),
  countryCode: z.string().length(2).toUpperCase().optional(),
});
export type MedicineReviewInput = z.infer<typeof medicineReviewSchema>;

const subRating = z.number().int().min(1).max(5).optional();
export const pharmacyReviewSchema = medicineReviewSchema.extend({
  staffRating: subRating,
  serviceRating: subRating,
  waitingRating: subRating,
  cleanlinessRating: subRating,
  accessibilityRating: subRating,
});
export type PharmacyReviewInput = z.infer<typeof pharmacyReviewSchema>;

export const reportReviewSchema = z.object({
  reason: z.enum(['SPAM', 'ABUSIVE', 'MEDICAL_MISINFORMATION', 'PERSONAL_DATA', 'OFF_TOPIC', 'OTHER']),
  details: z.string().trim().max(500).optional(),
});

export const comparisonHistorySchema = z.object({
  medicineIds: z.array(z.string()).min(MIN_COMPARE).max(MAX_COMPARE),
  title: z.string().max(120).optional(),
});
