import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { normaliseQuantity, normalizeText, tokenize, type MedicineSearchQuery, type Suggestion } from '@meddexa/shared';
import type { Env } from '../config/env';
import { FxService } from '../prices/fx.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseDose } from '../integrations/normalise';

const FUZZY_THRESHOLD = 0.45;

/** Builds a prefix tsquery ("ibupro:* & 400:*") from user input, safely. */
export function toPrefixTsQuery(q: string): string | null {
  const terms = tokenize(q)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((t) => t.length > 0)
    .slice(0, 8);
  return terms.length ? terms.map((t) => `${t}:*`).join(' & ') : null;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Medicine search on PostgreSQL: full-text (prefix tsquery over the denormalised search
   * document, which already contains localized names and ingredient synonyms) plus trigram
   * word similarity for spelling variations. Structured filters are exact.
   */
  async search(params: MedicineSearchQuery): Promise<{ ids: string[]; total: number }> {
    const where: Prisma.Sql[] = [Prisma.sql`m.status = 'ACTIVE'`, Prisma.sql`m."duplicateOfId" IS NULL`];
    if (!this.config.get('ALLOW_DEMO_DATA', { infer: true })) where.push(Prisma.sql`m."isDemo" = false`);

    const q = params.q ? normalizeText(params.q) : null;
    const tsq = params.q ? toPrefixTsQuery(params.q) : null;
    if (q && tsq) {
      where.push(
        Prisma.sql`(m."searchVector" @@ to_tsquery('simple', ${tsq}) OR word_similarity(${q}, m."searchText") > ${FUZZY_THRESHOLD})`,
      );
    }

    for (const raw of params.ingredients ?? []) {
      const t = normalizeText(raw);
      where.push(Prisma.sql`EXISTS (
        SELECT 1 FROM ingredient_quantities iq
        JOIN active_ingredients ai ON ai.id = iq."ingredientId"
        WHERE iq."medicineId" = m.id AND (
          ai."normalizedName" LIKE ${t + '%'}
          OR ai."moietyId" IN (SELECT id FROM active_ingredients WHERE "normalizedName" LIKE ${t + '%'})
          OR EXISTS (SELECT 1 FROM ingredient_synonyms s WHERE s."normalizedName" LIKE ${t + '%'} AND (s."ingredientId" = ai.id OR s."ingredientId" = ai."moietyId"))
        ))`);
    }
    if (params.manufacturer) {
      where.push(Prisma.sql`EXISTS (SELECT 1 FROM manufacturers mf WHERE mf.id = m."manufacturerId" AND mf."normalizedName" LIKE ${'%' + normalizeText(params.manufacturer) + '%'})`);
    }
    if (params.atc) where.push(Prisma.sql`m."atcCode" LIKE ${params.atc + '%'}`);
    if (params.form) where.push(Prisma.sql`m."formCode" = ${params.form}`);
    if (params.route) where.push(Prisma.sql`m.route = ${params.route}`);
    if (params.prescription) where.push(Prisma.sql`m.prescription = ${params.prescription}::"PrescriptionStatus"`);
    if (params.country) {
      where.push(Prisma.sql`(m."countryCode" = ${params.country} OR EXISTS (SELECT 1 FROM product_registrations r WHERE r."medicineId" = m.id AND r."countryCode" = ${params.country}))`);
    }
    if (params.strength) {
      const dose = parseDose(params.strength);
      const n = dose ? normaliseQuantity(dose.amount, dose.unit) : null;
      if (n && n.dimension === 'mass') {
        // Compare in mg regardless of how the source stored it (g, mg, µg).
        where.push(Prisma.sql`EXISTS (SELECT 1 FROM ingredient_quantities iq WHERE iq."medicineId" = m.id AND
          (CASE lower(iq.unit) WHEN 'g' THEN iq.amount * 1000 WHEN 'mg' THEN iq.amount WHEN 'µg' THEN iq.amount / 1000 WHEN 'mcg' THEN iq.amount / 1000 ELSE NULL END) = ${n.value})`);
      } else if (dose) {
        where.push(Prisma.sql`EXISTS (SELECT 1 FROM ingredient_quantities iq WHERE iq."medicineId" = m.id AND iq.amount = ${dose.amount} AND lower(iq.unit) = ${dose.unit.toLowerCase()})`);
      }
    }
    if (params.packageSize) {
      where.push(Prisma.sql`EXISTS (SELECT 1 FROM medicine_packages pk WHERE pk."medicineId" = m.id AND pk.quantity = ${params.packageSize})`);
    }
    if (params.barcode) {
      where.push(Prisma.sql`EXISTS (SELECT 1 FROM medicine_packages pk WHERE pk."medicineId" = m.id AND pk.barcode = ${params.barcode})`);
    }
    if (params.registrationNumber) {
      const rn = params.registrationNumber.toUpperCase();
      where.push(Prisma.sql`(EXISTS (SELECT 1 FROM product_registrations r WHERE r."medicineId" = m.id AND upper(r."registrationNumber") = ${rn})
        OR EXISTS (SELECT 1 FROM medicine_packages pk WHERE pk."medicineId" = m.id AND upper(pk."registrationNumber") = ${rn}))`);
    }

    const table = await this.fx.table();
    const rates = table ? Object.entries(table.rates) : [];
    const rateValues = rates.length
      ? Prisma.join(rates.map(([c, r]) => Prisma.sql`(${c}::text, ${r}::numeric)`))
      : Prisma.sql`('EUR'::text, 1::numeric)`;
    const staleAfter = new Date(Date.now() - this.config.get('PRICE_STALE_DAYS', { infer: true }) * 86_400_000);
    const demoOffers = this.config.get('ALLOW_DEMO_DATA', { infer: true }) ? Prisma.empty : Prisma.sql`AND o."isDemo" = false`;

    const priceExpr = Prisma.sql`(SELECT min(p.amount / (CASE WHEN p.currency = 'EUR' THEN 1 ELSE r.rate END))
        FROM pharmacy_offers o
        JOIN medicine_packages pk ON pk.id = o."packageId"
        JOIN prices p ON p."offerId" = o.id
        LEFT JOIN rates r ON r.currency = p.currency
        WHERE pk."medicineId" = m.id AND p."observedAt" >= ${staleAfter} AND p.verification <> 'OUTDATED' ${demoOffers})`;
    if (params.hasPrice) where.push(Prisma.sql`${priceExpr} IS NOT NULL`);

    const scoreExpr = q && tsq
      ? Prisma.sql`(ts_rank(m."searchVector", to_tsquery('simple', ${tsq})) * 2
          + word_similarity(${q}, m."searchText")
          + CASE WHEN m."normalizedName" LIKE ${q + '%'} THEN 1.5 ELSE 0 END
          + CASE WHEN lower(coalesce(m.brand, '')) LIKE ${q + '%'} THEN 1 ELSE 0 END)`
      : Prisma.sql`0`;

    const orderBy = {
      relevance: Prisma.sql`score DESC, m.name ASC`,
      name: Prisma.sql`m.name ASC`,
      price_asc: Prisma.sql`price_eur ASC NULLS LAST, m.name ASC`,
      price_desc: Prisma.sql`price_eur DESC NULLS LAST, m.name ASC`,
      rating: Prisma.sql`rating DESC NULLS LAST, m.name ASC`,
    }[params.sort];

    const offset = (params.page - 1) * params.pageSize;
    const rows = await this.prisma.$queryRaw<{ id: string; total: bigint }[]>(Prisma.sql`
      WITH rates(currency, rate) AS (VALUES ${rateValues})
      SELECT m.id, count(*) OVER() AS total,
        ${scoreExpr} AS score,
        ${priceExpr} AS price_eur,
        (SELECT avg(rv.rating) FROM reviews rv WHERE rv."medicineId" = m.id AND rv.status = 'PUBLISHED') AS rating
      FROM medicines m
      WHERE ${Prisma.join(where, ' AND ')}
      ORDER BY ${orderBy}
      LIMIT ${params.pageSize} OFFSET ${offset}`);

    return { ids: rows.map((r) => r.id), total: rows.length ? Number(rows[0]!.total) : 0 };
  }

  async suggest(raw: string): Promise<Suggestion[]> {
    const q = normalizeText(raw);
    if (!q) return [];
    const demo = this.config.get('ALLOW_DEMO_DATA', { infer: true }) ? Prisma.empty : Prisma.sql`AND m."isDemo" = false`;
    const prefix = q + '%';
    const rows = await this.prisma.$queryRaw<{ type: Suggestion['type']; id: string; label: string; secondary: string | null; score: number }[]>(Prisma.sql`
      (SELECT 'medicine' AS type, m.id, m.name AS label, mf.name AS secondary,
              (CASE WHEN m."normalizedName" LIKE ${prefix} THEN 2 ELSE 0 END + similarity(${q}, m."normalizedName"))::float AS score
         FROM medicines m LEFT JOIN manufacturers mf ON mf.id = m."manufacturerId"
        WHERE m.status = 'ACTIVE' AND m."duplicateOfId" IS NULL ${demo}
          AND (m."normalizedName" LIKE ${'%' + q + '%'} OR word_similarity(${q}, m."normalizedName") > 0.5
               OR EXISTS (SELECT 1 FROM product_synonyms ps WHERE ps."medicineId" = m.id AND ps."normalizedName" LIKE ${prefix}))
        ORDER BY score DESC LIMIT 6)
      UNION ALL
      (SELECT DISTINCT ON (ai.id) 'ingredient' AS type, ai.id, ai.name AS label,
              CASE WHEN s."normalizedName" IS NOT NULL AND s."normalizedName" <> ai."normalizedName" THEN s.name END AS secondary,
              (1.5 + similarity(${q}, coalesce(s."normalizedName", ai."normalizedName")))::float AS score
         FROM active_ingredients ai LEFT JOIN ingredient_synonyms s ON s."ingredientId" = ai.id AND s."normalizedName" LIKE ${prefix}
        WHERE ai."normalizedName" LIKE ${prefix} OR s.id IS NOT NULL
        ORDER BY ai.id, score DESC LIMIT 4)
      UNION ALL
      (SELECT 'manufacturer' AS type, mf.id, mf.name AS label, NULL AS secondary, 1::float AS score
         FROM manufacturers mf WHERE mf."normalizedName" LIKE ${prefix} LIMIT 2)
      UNION ALL
      (SELECT 'atc' AS type, a.code AS id, a.code || ' — ' || a.name AS label, NULL AS secondary, 1.2::float AS score
         FROM atc_classes a WHERE lower(a.code) LIKE ${prefix} OR lower(a.name) LIKE ${prefix} LIMIT 3)
      ORDER BY score DESC LIMIT 10`);
    return rows.map(({ score: _score, ...r }) => r);
  }
}
