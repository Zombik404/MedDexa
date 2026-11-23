import { z } from 'zod';

export const adminListSchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().max(30).optional(),
  country: z.string().length(2).toUpperCase().optional(),
  stale: z.enum(['true', 'false']).optional(),
  demo: z.enum(['true', 'false']).optional(),
  entityType: z.string().max(40).optional(),
  sourceId: z.string().max(60).optional(),
});
export type AdminListQuery = z.infer<typeof adminListSchema>;

const nullableStr = z.string().trim().max(300).nullable().optional();

export const medicineUpsertSchema = z.object({
  name: z.string().trim().min(2).max(200),
  brand: nullableStr,
  manufacturerId: z.string().nullable().optional(),
  atcCode: z.string().trim().toUpperCase().max(7).nullable().optional(),
  formCode: z.string().nullable().optional(),
  route: z.string().max(40).nullable().optional(),
  release: z.enum(['IMMEDIATE', 'MODIFIED', 'PROLONGED', 'DELAYED', 'GASTRO_RESISTANT', 'UNKNOWN']).optional(),
  prescription: z.enum(['RX', 'OTC', 'PHARMACY_ONLY', 'UNKNOWN']).optional(),
  countryCode: z.string().length(2).toUpperCase().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  /** Required attribution of the image source (licence holder). */
  imageCredit: z.string().trim().max(120).nullable().optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  verification: z.enum(['VERIFIED', 'UNVERIFIED', 'OUTDATED']).optional(),
});

export const ingredientsReplaceSchema = z.object({
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string(),
        amount: z.number().positive().nullable(),
        unit: z.string().max(20).nullable(),
        perAmount: z.number().positive().nullable().optional(),
        perUnit: z.string().max(20).nullable().optional(),
        basis: z.enum(['SUBSTANCE', 'MOIETY']).default('SUBSTANCE'),
      }),
    )
    .max(20)
    .refine((list) => new Set(list.map((i) => i.ingredientId)).size === list.length, 'Duplicate ingredient'),
});

export const packageSchema = z.object({
  quantity: z.number().positive(),
  unit: z.string().min(1).max(20),
  description: z.string().max(200).optional(),
  barcode: z.string().regex(/^\d{8,14}$/).nullable().optional(),
  registrationNumber: z.string().max(60).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const registrationSchema = z.object({
  countryCode: z.string().length(2).toUpperCase(),
  authority: z.string().min(2).max(120),
  registrationNumber: z.string().max(60).nullable().optional(),
  localName: z.string().min(2).max(200),
  status: z.enum(['AUTHORISED', 'SUSPENDED', 'WITHDRAWN', 'UNKNOWN']).default('UNKNOWN'),
});

export const synonymSchema = z.object({
  name: z.string().min(1).max(200),
  language: z.string().max(10).nullable().optional(),
  countryCode: z.string().length(2).toUpperCase().nullable().optional(),
  kind: z.enum(['BRAND', 'LOCAL_NAME', 'INN', 'SPELLING', 'OTHER']).default('OTHER'),
});

export const ingredientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  moietyId: z.string().nullable().optional(),
  casNumber: z.string().max(20).nullable().optional(),
  synonyms: z.array(z.object({ name: z.string().min(1).max(120), language: z.string().max(10).nullable().optional() })).optional(),
});

export const manufacturerSchema = z.object({
  name: z.string().trim().min(2).max(160),
  countryCode: z.string().length(2).toUpperCase().nullable().optional(),
  website: z.string().url().nullable().optional(),
});

export const formSchema = z.object({
  code: z.string().regex(/^[A-Z_]{2,40}$/),
  name: z.string().min(2).max(80),
  group: z.string().max(40).nullable().optional(),
  edqmCode: z.string().max(20).nullable().optional(),
});

export const pharmacyUpsertSchema = z.object({
  name: z.string().trim().min(2).max(160),
  street: z.string().trim().max(200),
  city: z.string().trim().max(100).nullable().optional(),
  postcode: z.string().trim().max(12).nullable().optional(),
  countryCode: z.string().length(2).toUpperCase(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  timezone: z.string().max(40).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  phoneVerified: z.boolean().optional(),
  website: z.string().url().nullable().optional(),
  websiteVerified: z.boolean().optional(),
  email: z.string().email().nullable().optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  verification: z.enum(['VERIFIED', 'UNVERIFIED', 'OUTDATED']).optional(),
});

export const hoursSchema = z.object({
  hours: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        opens: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        closes: z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/),
      }),
    )
    .max(28),
});

export const servicesSchema = z.object({ services: z.array(z.string()).max(30) });

export const priceUpdateSchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3).toUpperCase(),
  observedAt: z.coerce.date().optional(),
  verification: z.enum(['VERIFIED', 'UNVERIFIED', 'OUTDATED']).default('VERIFIED'),
  priceType: z.enum(['RETAIL', 'MAX_RETAIL', 'REIMBURSEMENT_REFERENCE']).optional(),
});

export const availabilitySchema = z.object({
  offerId: z.string(),
  status: z.enum(['IN_STOCK', 'LIMITED', 'OUT_OF_STOCK', 'UNKNOWN']),
  sourceId: z.string().default('manual'),
});

export const reviewModerationSchema = z.object({
  status: z.enum(['PUBLISHED', 'REJECTED', 'REMOVED', 'PENDING']),
  note: z.string().max(500).optional(),
});

export const reportResolutionSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  removeReview: z.boolean().default(false),
});

export const userUpdateSchema = z.object({
  role: z.enum(['USER', 'MODERATOR', 'EDITOR', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

export const sourceUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  url: z.string().url().nullable().optional(),
});

export const mergeSchema = z.object({ intoId: z.string() });

export const productCodeSchema = z.object({
  system: z.enum(['GTIN', 'CN_ES', 'CIP13', 'CIP7', 'PZN', 'TTT_HU', 'AIM_PT', 'OTHER']),
  code: z.string().trim().min(4).max(40),
  countryCode: z.string().length(2).toUpperCase().nullable().optional(),
  packageId: z.string().nullable().optional(),
});
