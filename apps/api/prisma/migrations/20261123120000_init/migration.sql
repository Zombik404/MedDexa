-- MedDexa initial schema.
-- Generated from prisma/schema.prisma, plus hand-written search indexes and integrity
-- checks at the end of this file (Prisma cannot express them in the schema).

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'EDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "Verification" AS ENUM ('VERIFIED', 'UNVERIFIED', 'OUTDATED', 'DEMO');

-- CreateEnum
CREATE TYPE "ReleaseMechanism" AS ENUM ('IMMEDIATE', 'MODIFIED', 'PROLONGED', 'DELAYED', 'GASTRO_RESISTANT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('RX', 'OTC', 'PHARMACY_ONLY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StrengthBasis" AS ENUM ('SUBSTANCE', 'MOIETY');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('AUTHORISED', 'SUSPENDED', 'WITHDRAWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SynonymKind" AS ENUM ('BRAND', 'LOCAL_NAME', 'INN', 'SPELLING', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('SMPC', 'PIL', 'EPAR', 'LABEL', 'OTHER');

-- CreateEnum
CREATE TYPE "SafetyKind" AS ENUM ('WARNINGS', 'CONTRAINDICATIONS', 'SIDE_EFFECTS', 'DOSAGE');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('RETAIL', 'MAX_RETAIL', 'REIMBURSEMENT_REFERENCE');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('IN_STOCK', 'LIMITED', 'OUT_OF_STOCK', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReviewTarget" AS ENUM ('MEDICINE', 'PHARMACY');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'ABUSIVE', 'MEDICAL_MISINFORMATION', 'PERSONAL_DATA', 'OFF_TOPIC', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DataSourceKind" AS ENUM ('MEDICINES', 'PHARMACIES', 'PRICES', 'AVAILABILITY', 'FX', 'DOCUMENTS');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('SEARCH', 'SUGGEST', 'COMPARE', 'VIEW_MEDICINE', 'VIEW_PHARMACY', 'PHARMACY_SEARCH');

-- CreateTable
CREATE TABLE "countries" (
    "code" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "defaultLanguage" VARCHAR(10) NOT NULL,
    "supported" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Brussels',

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "languages" (
    "code" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "currencies" (
    "code" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "digits" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "base" CHAR(3) NOT NULL DEFAULT 'EUR',
    "currency" CHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "rateDate" DATE NOT NULL,
    "sourceId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "userId" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "countryCode" CHAR(2),
    "theme" TEXT NOT NULL DEFAULT 'system',
    "notifyPriceChanges" BOOLEAN NOT NULL DEFAULT false,
    "notifyProductUpdates" BOOLEAN NOT NULL DEFAULT false,
    "analyticsConsent" BOOLEAN NOT NULL DEFAULT false,
    "saveSearchHistory" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "countryCode" CHAR(2),
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_ingredients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "moietyId" TEXT,
    "casNumber" TEXT,
    "description" TEXT,

    CONSTRAINT "active_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_synonyms" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "language" VARCHAR(10),

    CONSTRAINT "ingredient_synonyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmaceutical_forms" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT,
    "edqmCode" TEXT,

    CONSTRAINT "pharmaceutical_forms_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "atc_classes" (
    "code" VARCHAR(7) NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parentCode" VARCHAR(7),

    CONSTRAINT "atc_classes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "medicines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "brand" TEXT,
    "manufacturerId" TEXT,
    "atcCode" VARCHAR(7),
    "formCode" TEXT,
    "route" TEXT,
    "release" "ReleaseMechanism" NOT NULL DEFAULT 'UNKNOWN',
    "prescription" "PrescriptionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "countryCode" CHAR(2),
    "imageUrl" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "duplicateOfId" TEXT,
    "searchText" TEXT NOT NULL DEFAULT '',
    "searchVector" tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, coalesce("searchText", ''))) STORED,
    "sourceId" TEXT,
    "sourceReference" TEXT,
    "syncedAt" TIMESTAMP(3),
    "verification" "Verification" NOT NULL DEFAULT 'UNVERIFIED',
    "confidence" DOUBLE PRECISION,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_quantities" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "amount" DECIMAL(14,6),
    "unit" TEXT,
    "perAmount" DECIMAL(14,6),
    "perUnit" TEXT,
    "basis" "StrengthBasis" NOT NULL DEFAULT 'SUBSTANCE',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ingredient_quantities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_packages" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "barcode" TEXT,
    "registrationNumber" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicine_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_registrations" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "authority" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "localName" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'UNKNOWN',
    "authorisedAt" TIMESTAMP(3),
    "sourceId" TEXT,
    "sourceReference" TEXT,
    "syncedAt" TIMESTAMP(3),
    "verification" "Verification" NOT NULL DEFAULT 'UNVERIFIED',

    CONSTRAINT "product_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_synonyms" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "language" VARCHAR(10),
    "countryCode" CHAR(2),
    "kind" "SynonymKind" NOT NULL DEFAULT 'OTHER',

    CONSTRAINT "product_synonyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_documents" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "countryCode" CHAR(2),
    "url" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceReference" TEXT,
    "syncedAt" TIMESTAMP(3),
    "verification" "Verification" NOT NULL DEFAULT 'UNVERIFIED',

    CONSTRAINT "medicine_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_sections" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "kind" "SafetyKind" NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "countryCode" CHAR(2),
    "content" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceReference" TEXT,
    "syncedAt" TIMESTAMP(3),
    "verification" "Verification" NOT NULL DEFAULT 'UNVERIFIED',

    CONSTRAINT "safety_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT,
    "postcode" TEXT,
    "countryCode" CHAR(2) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT,
    "phone" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "website" TEXT,
    "websiteVerified" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceId" TEXT,
    "sourceReference" TEXT,
    "syncedAt" TIMESTAMP(3),
    "verification" "Verification" NOT NULL DEFAULT 'UNVERIFIED',
    "confidence" DOUBLE PRECISION,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_hours" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "opens" TEXT NOT NULL,
    "closes" TEXT NOT NULL,

    CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_services" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "pharmacy_services_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "pharmacy_service_links" (
    "pharmacyId" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,

    CONSTRAINT "pharmacy_service_links_pkey" PRIMARY KEY ("pharmacyId","serviceCode")
);

-- CreateTable
CREATE TABLE "pharmacy_offers" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "pharmacyId" TEXT,
    "countryCode" CHAR(2) NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceReference" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prices" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "priceType" "PriceType" NOT NULL DEFAULT 'RETAIL',
    "observedAt" TIMESTAMP(3) NOT NULL,
    "verification" "Verification" NOT NULL DEFAULT 'UNVERIFIED',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_snapshots" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_records" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "status" "AvailabilityStatus" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "availability_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "target" "ReviewTarget" NOT NULL,
    "medicineId" TEXT,
    "pharmacyId" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "countryCode" CHAR(2),
    "staffRating" INTEGER,
    "serviceRating" INTEGER,
    "waitingRating" INTEGER,
    "cleanlinessRating" INTEGER,
    "accessibilityRating" INTEGER,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "moderationNote" TEXT,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_votes" (
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_votes_pkey" PRIMARY KEY ("reviewId","userId")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DataSourceKind" NOT NULL,
    "adapter" TEXT NOT NULL,
    "countryCode" CHAR(2),
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT,
    "licence" TEXT,
    "attribution" TEXT,
    "config" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastStatus" "SyncStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_sync_logs" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'schedule',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "details" JSONB,

    CONSTRAINT "data_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "medicineId" TEXT,
    "pharmacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "filters" JSONB,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparison_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "medicineIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparison_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recently_viewed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "medicineId" TEXT,
    "pharmacyId" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recently_viewed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "query" TEXT,
    "entityId" TEXT,
    "countryCode" CHAR(2),
    "resultCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exchange_rates_rateDate_idx" ON "exchange_rates"("rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_currency_rateDate_sourceId_key" ON "exchange_rates"("currency", "rateDate", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_normalizedName_key" ON "manufacturers"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "active_ingredients_normalizedName_key" ON "active_ingredients"("normalizedName");

-- CreateIndex
CREATE INDEX "ingredient_synonyms_normalizedName_idx" ON "ingredient_synonyms"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_synonyms_ingredientId_normalizedName_key" ON "ingredient_synonyms"("ingredientId", "normalizedName");

-- CreateIndex
CREATE INDEX "medicines_normalizedName_idx" ON "medicines"("normalizedName");

-- CreateIndex
CREATE INDEX "medicines_atcCode_idx" ON "medicines"("atcCode");

-- CreateIndex
CREATE INDEX "medicines_manufacturerId_idx" ON "medicines"("manufacturerId");

-- CreateIndex
CREATE INDEX "medicines_formCode_idx" ON "medicines"("formCode");

-- CreateIndex
CREATE INDEX "medicines_countryCode_idx" ON "medicines"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "medicines_sourceId_sourceReference_key" ON "medicines"("sourceId", "sourceReference");

-- CreateIndex
CREATE INDEX "ingredient_quantities_ingredientId_idx" ON "ingredient_quantities"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_quantities_medicineId_ingredientId_key" ON "ingredient_quantities"("medicineId", "ingredientId");

-- CreateIndex
CREATE INDEX "medicine_packages_medicineId_idx" ON "medicine_packages"("medicineId");

-- CreateIndex
CREATE INDEX "medicine_packages_barcode_idx" ON "medicine_packages"("barcode");

-- CreateIndex
CREATE INDEX "product_registrations_medicineId_idx" ON "product_registrations"("medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "product_registrations_countryCode_registrationNumber_key" ON "product_registrations"("countryCode", "registrationNumber");

-- CreateIndex
CREATE INDEX "product_synonyms_normalizedName_idx" ON "product_synonyms"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "product_synonyms_medicineId_normalizedName_countryCode_key" ON "product_synonyms"("medicineId", "normalizedName", "countryCode");

-- CreateIndex
CREATE INDEX "medicine_documents_medicineId_idx" ON "medicine_documents"("medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "safety_sections_medicineId_kind_language_countryCode_key" ON "safety_sections"("medicineId", "kind", "language", "countryCode");

-- CreateIndex
CREATE INDEX "pharmacies_countryCode_city_idx" ON "pharmacies"("countryCode", "city");

-- CreateIndex
CREATE INDEX "pharmacies_postcode_idx" ON "pharmacies"("postcode");

-- CreateIndex
CREATE INDEX "pharmacies_lat_lng_idx" ON "pharmacies"("lat", "lng");

-- CreateIndex
CREATE INDEX "pharmacies_normalizedName_idx" ON "pharmacies"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacies_sourceId_sourceReference_key" ON "pharmacies"("sourceId", "sourceReference");

-- CreateIndex
CREATE INDEX "opening_hours_pharmacyId_idx" ON "opening_hours"("pharmacyId");

-- CreateIndex
CREATE INDEX "pharmacy_offers_countryCode_idx" ON "pharmacy_offers"("countryCode");

-- CreateIndex
CREATE INDEX "pharmacy_offers_pharmacyId_idx" ON "pharmacy_offers"("pharmacyId");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_offers_packageId_pharmacyId_sourceId_key" ON "pharmacy_offers"("packageId", "pharmacyId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "prices_offerId_key" ON "prices"("offerId");

-- CreateIndex
CREATE INDEX "prices_observedAt_idx" ON "prices"("observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "price_snapshots_offerId_capturedAt_key" ON "price_snapshots"("offerId", "capturedAt");

-- CreateIndex
CREATE INDEX "availability_records_offerId_observedAt_idx" ON "availability_records"("offerId", "observedAt");

-- CreateIndex
CREATE INDEX "reviews_medicineId_status_idx" ON "reviews"("medicineId", "status");

-- CreateIndex
CREATE INDEX "reviews_pharmacyId_status_idx" ON "reviews"("pharmacyId", "status");

-- CreateIndex
CREATE INDEX "reviews_status_createdAt_idx" ON "reviews"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_authorId_medicineId_key" ON "reviews"("authorId", "medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_authorId_pharmacyId_key" ON "reviews"("authorId", "pharmacyId");

-- CreateIndex
CREATE INDEX "review_reports_status_idx" ON "review_reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "review_reports_reviewId_reporterId_key" ON "review_reports"("reviewId", "reporterId");

-- CreateIndex
CREATE INDEX "data_sync_logs_sourceId_startedAt_idx" ON "data_sync_logs"("sourceId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_medicineId_key" ON "favorites"("userId", "medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_pharmacyId_key" ON "favorites"("userId", "pharmacyId");

-- CreateIndex
CREATE INDEX "search_history_userId_createdAt_idx" ON "search_history"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "comparison_history_userId_createdAt_idx" ON "comparison_history"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "recently_viewed_userId_viewedAt_idx" ON "recently_viewed"("userId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "recently_viewed_userId_medicineId_key" ON "recently_viewed"("userId", "medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "recently_viewed_userId_pharmacyId_key" ON "recently_viewed"("userId", "pharmacyId");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "analytics_events_type_createdAt_idx" ON "analytics_events"("type", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_entityId_idx" ON "analytics_events"("entityId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_ingredients" ADD CONSTRAINT "active_ingredients_moietyId_fkey" FOREIGN KEY ("moietyId") REFERENCES "active_ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_synonyms" ADD CONSTRAINT "ingredient_synonyms_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "active_ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atc_classes" ADD CONSTRAINT "atc_classes_parentCode_fkey" FOREIGN KEY ("parentCode") REFERENCES "atc_classes"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_atcCode_fkey" FOREIGN KEY ("atcCode") REFERENCES "atc_classes"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_formCode_fkey" FOREIGN KEY ("formCode") REFERENCES "pharmaceutical_forms"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "medicines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_quantities" ADD CONSTRAINT "ingredient_quantities_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_quantities" ADD CONSTRAINT "ingredient_quantities_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "active_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_packages" ADD CONSTRAINT "medicine_packages_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_synonyms" ADD CONSTRAINT "product_synonyms_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_documents" ADD CONSTRAINT "medicine_documents_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_documents" ADD CONSTRAINT "medicine_documents_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_sections" ADD CONSTRAINT "safety_sections_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_sections" ADD CONSTRAINT "safety_sections_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacies" ADD CONSTRAINT "pharmacies_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacies" ADD CONSTRAINT "pharmacies_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_service_links" ADD CONSTRAINT "pharmacy_service_links_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_service_links" ADD CONSTRAINT "pharmacy_service_links_serviceCode_fkey" FOREIGN KEY ("serviceCode") REFERENCES "pharmacy_services"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_offers" ADD CONSTRAINT "pharmacy_offers_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "medicine_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_offers" ADD CONSTRAINT "pharmacy_offers_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_offers" ADD CONSTRAINT "pharmacy_offers_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_offers" ADD CONSTRAINT "pharmacy_offers_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "pharmacy_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "pharmacy_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_records" ADD CONSTRAINT "availability_records_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "pharmacy_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_records" ADD CONSTRAINT "availability_records_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_sync_logs" ADD CONSTRAINT "data_sync_logs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_history" ADD CONSTRAINT "comparison_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ───────────── Search ─────────────
-- Full-text index on the generated tsvector and trigram indexes for fuzzy matching
-- (spelling variations, partial names).
CREATE INDEX "medicines_searchVector_idx" ON "medicines" USING GIN ("searchVector");
CREATE INDEX "medicines_searchText_trgm_idx" ON "medicines" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX "product_synonyms_normalizedName_trgm_idx" ON "product_synonyms" USING GIN ("normalizedName" gin_trgm_ops);
CREATE INDEX "ingredient_synonyms_normalizedName_trgm_idx" ON "ingredient_synonyms" USING GIN ("normalizedName" gin_trgm_ops);
CREATE INDEX "active_ingredients_normalizedName_trgm_idx" ON "active_ingredients" USING GIN ("normalizedName" gin_trgm_ops);
CREATE INDEX "manufacturers_normalizedName_trgm_idx" ON "manufacturers" USING GIN ("normalizedName" gin_trgm_ops);
CREATE INDEX "pharmacies_normalizedName_trgm_idx" ON "pharmacies" USING GIN ("normalizedName" gin_trgm_ops);

-- ───────────── Integrity checks ─────────────
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_subratings_range" CHECK (
  ("staffRating" IS NULL OR "staffRating" BETWEEN 1 AND 5) AND
  ("serviceRating" IS NULL OR "serviceRating" BETWEEN 1 AND 5) AND
  ("waitingRating" IS NULL OR "waitingRating" BETWEEN 1 AND 5) AND
  ("cleanlinessRating" IS NULL OR "cleanlinessRating" BETWEEN 1 AND 5) AND
  ("accessibilityRating" IS NULL OR "accessibilityRating" BETWEEN 1 AND 5));
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_single_target" CHECK (
  ("target" = 'MEDICINE' AND "medicineId" IS NOT NULL AND "pharmacyId" IS NULL) OR
  ("target" = 'PHARMACY' AND "pharmacyId" IS NOT NULL AND "medicineId" IS NULL));
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_single_target" CHECK (num_nonnulls("medicineId", "pharmacyId") = 1);
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_single_target" CHECK (num_nonnulls("medicineId", "pharmacyId") = 1);
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_day_range" CHECK ("day" BETWEEN 0 AND 6);
ALTER TABLE "pharmacies" ADD CONSTRAINT "pharmacies_coordinates_range" CHECK ("lat" BETWEEN -90 AND 90 AND "lng" BETWEEN -180 AND 180);
ALTER TABLE "prices" ADD CONSTRAINT "prices_amount_positive" CHECK ("amount" >= 0);
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_amount_positive" CHECK ("amount" >= 0);
ALTER TABLE "medicine_packages" ADD CONSTRAINT "medicine_packages_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_rate_positive" CHECK ("rate" > 0);
