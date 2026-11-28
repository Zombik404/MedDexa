import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  categoryBySlug,
  hasCyrillic,
  transliterateCyrillic,
  normaliseQuantity,
  normalizeText,
  parseScannedCode,
  tokenize,
  type FilterOption,
  type FilterOptionField,
  type IngredientHit,
  type IngredientNames,
  type MedicineSearchQuery,
  type Suggestion,
} from '@meddexa/shared';
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

    // Cyrillic queries (ru/uk users) are matched through their Latin transliteration.
    const rawQ = params.q && hasCyrillic(params.q) ? transliterateCyrillic(params.q) : params.q;
    const q = rawQ ? normalizeText(rawQ) : null;
    const tsq = rawQ ? toPrefixTsQuery(rawQ) : null;
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
    if (params.category) {
      const cat = categoryBySlug(params.category);
      // Unknown slug: match nothing rather than everything.
      const prefixes = cat ? cat.atcPrefixes.map((p) => `${p}%`) : ['__none__'];
      where.push(Prisma.sql`m."atcCode" LIKE ANY (${prefixes}::text[])`);
    }
    if (params.form) where.push(Prisma.sql`m."formCode" = ${params.form}`);
    if (params.route) where.push(Prisma.sql`m.route = ${params.route}`);
    if (params.prescription) where.push(Prisma.sql`m.prescription = ${params.prescription}::"PrescriptionStatus"`);
    if (params.country?.length) {
      const countries = params.country;
      where.push(Prisma.sql`(m."countryCode" = ANY (${countries}::text[]) OR EXISTS (SELECT 1 FROM product_registrations r WHERE r."medicineId" = m.id AND r."countryCode" = ANY (${countries}::text[])))`);
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
      const scan = parseScannedCode(params.barcode);
      const codes = scan.candidates.map((c) => c.code);
      const raw = [params.barcode, ...(scan.gtin ? [scan.gtin, scan.gtin.replace(/^0/, '')] : [])];
      where.push(Prisma.sql`(EXISTS (SELECT 1 FROM medicine_packages pk WHERE pk."medicineId" = m.id AND pk.barcode = ANY (${raw}::text[]))
        OR EXISTS (SELECT 1 FROM product_codes pc WHERE pc."medicineId" = m.id AND pc.code = ANY (${codes.length ? codes : ['__none__']}::text[])))`);
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

  async suggest(input: string): Promise<Suggestion[]> {
    const raw = hasCyrillic(input) ? transliterateCyrillic(input) : input;
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

  /** Active ingredients matching a name or translated synonym, with how many products contain them. */
  async ingredients(input: string): Promise<IngredientHit[]> {
    const q = normalizeText(hasCyrillic(input) ? transliterateCyrillic(input) : input);
    if (q.length < 2) return [];
    const demo = this.config.get('ALLOW_DEMO_DATA', { infer: true }) ? Prisma.empty : Prisma.sql`AND m."isDemo" = false`;
    const rows = await this.prisma.$queryRaw<{ id: string; name: string; synonym: string | null; count: bigint }[]>(Prisma.sql`
      SELECT ai.id, ai.name,
        CASE WHEN ai."normalizedName" LIKE ${q + '%'} THEN NULL ELSE
          (SELECT s.name FROM ingredient_synonyms s WHERE s."ingredientId" = ai.id AND s."normalizedName" LIKE ${q + '%'} LIMIT 1) END AS synonym,
        (SELECT count(DISTINCT m.id) FROM ingredient_quantities iq
           JOIN active_ingredients x ON x.id = iq."ingredientId"
           JOIN medicines m ON m.id = iq."medicineId"
          WHERE (x.id = ai.id OR x."moietyId" = ai.id) AND m.status = 'ACTIVE' AND m."duplicateOfId" IS NULL ${demo}) AS count
      FROM active_ingredients ai
      WHERE ai."normalizedName" LIKE ${q + '%'}
         OR ai."normalizedName" LIKE ${'% ' + q + '%'}
         OR EXISTS (SELECT 1 FROM ingredient_synonyms s WHERE s."ingredientId" = ai.id AND s."normalizedName" LIKE ${q + '%'})
      ORDER BY (ai."normalizedName" LIKE ${q + '%'}) DESC, ai.name
      LIMIT 8`);
    return rows.filter((r) => Number(r.count) > 0).map((r) => ({ id: r.id, name: r.name, synonym: r.synonym, medicineCount: Number(r.count) }));
  }

  /** Candidate ids for words read from a box (any word may match), best text rank first. */
  async candidatesForWords(words: string[], limit = 30): Promise<string[]> {
    const terms = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter((w) => w.length >= 3);
    if (!terms.length) return [];
    const orq = terms.map((t) => `${t}:*`).join(' | ');
    const demo = this.config.get('ALLOW_DEMO_DATA', { infer: true }) ? Prisma.empty : Prisma.sql`AND m."isDemo" = false`;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT m.id FROM medicines m
      WHERE m.status = 'ACTIVE' AND m."duplicateOfId" IS NULL ${demo}
        AND m."searchVector" @@ to_tsquery('simple', ${orq})
      ORDER BY ts_rank(m."searchVector", to_tsquery('simple', ${orq})) DESC, m.name
      LIMIT ${limit}`);
    return rows.map((r) => r.id);
  }

  /** Type-ahead values for one search filter, starting with what was typed, most common first. */
  async filterOptions(field: FilterOptionField, input: string): Promise<FilterOption[]> {
    const raw = hasCyrillic(input) ? transliterateCyrillic(input) : input;
    const q = normalizeText(raw);
    const like = `${q}%`;
    const demo = this.config.get('ALLOW_DEMO_DATA', { infer: true }) ? Prisma.empty : Prisma.sql`AND m."isDemo" = false`;
    const live = Prisma.sql`m.status = 'ACTIVE' AND m."duplicateOfId" IS NULL ${demo}`;
    type Row = { value: string; label: string; secondary: string | null; count: bigint };
    let rows: Row[] = [];
    switch (field) {
      case 'ingredient':
        if (q.length >= 2) return (await this.ingredients(raw)).map((h) => ({ value: h.name, label: h.name, secondary: h.synonym, count: h.medicineCount }));
        rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
          SELECT coalesce(mo.name, ai.name) AS value, coalesce(mo.name, ai.name) AS label, NULL AS secondary, count(DISTINCT m.id) AS count
          FROM ingredient_quantities iq JOIN active_ingredients ai ON ai.id = iq."ingredientId"
          LEFT JOIN active_ingredients mo ON mo.id = ai."moietyId" JOIN medicines m ON m.id = iq."medicineId"
          WHERE ${live} AND coalesce(mo."normalizedName", ai."normalizedName") LIKE ${like}
          GROUP BY 1, 2 ORDER BY count DESC, 1 LIMIT 12`);
        break;
      case 'manufacturer':
        rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
          SELECT mf.name AS value, mf.name AS label, NULL AS secondary, count(*) AS count
          FROM medicines m JOIN manufacturers mf ON mf.id = m."manufacturerId"
          WHERE ${live} AND (mf."normalizedName" LIKE ${like} OR mf."normalizedName" LIKE ${'% ' + like})
          GROUP BY mf.name, mf."normalizedName" ORDER BY (mf."normalizedName" LIKE ${like}) DESC, count DESC, mf.name LIMIT 12`);
        break;
      case 'atc':
        rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
          SELECT a.code AS value, a.code AS label, a.name AS secondary,
            (SELECT count(*) FROM medicines m WHERE ${live} AND m."atcCode" LIKE a.code || '%') AS count
          FROM atc_classes a
          WHERE a.code ILIKE ${raw.trim().toUpperCase() + '%'} OR lower(a.name) LIKE ${like} OR lower(a.name) LIKE ${'% ' + like}
          ORDER BY (a.code ILIKE ${raw.trim().toUpperCase() + '%'}) DESC, length(a.code), a.code LIMIT 40`);
        rows = rows.filter((r) => Number(r.count) > 0).slice(0, 12);
        break;
      case 'strength':
        rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
          SELECT s.v AS value, s.v AS label, NULL AS secondary, count(DISTINCT s.mid) AS count FROM (
            SELECT trim(trailing '.' FROM trim(trailing '0' FROM iq.amount::text)) || ' ' || iq.unit
              || coalesce('/' || nullif(trim(trailing '.' FROM trim(trailing '0' FROM iq."perAmount"::text)), '1') || iq."perUnit", coalesce('/' || iq."perUnit", '')) AS v,
              m.id AS mid
            FROM ingredient_quantities iq JOIN medicines m ON m.id = iq."medicineId"
            WHERE ${live} AND iq.amount IS NOT NULL AND iq.unit IS NOT NULL) s
          WHERE lower(s.v) LIKE ${like} GROUP BY s.v ORDER BY count DESC, s.v LIMIT 12`);
        break;
      case 'packageSize':
        rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
          SELECT trim(trailing '.' FROM trim(trailing '0' FROM pk.quantity::text)) AS value,
            trim(trailing '.' FROM trim(trailing '0' FROM pk.quantity::text)) || ' ' || pk.unit AS label, NULL AS secondary, count(DISTINCT m.id) AS count
          FROM medicine_packages pk JOIN medicines m ON m.id = pk."medicineId"
          WHERE ${live} AND pk.quantity::text LIKE ${like}
          GROUP BY 1, 2 ORDER BY count DESC, min(pk.quantity) LIMIT 12`);
        break;
      case 'registration':
        rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
          SELECT r."registrationNumber" AS value, r."registrationNumber" AS label, r."countryCode" || ' · ' || m.name AS secondary, 1::bigint AS count
          FROM product_registrations r JOIN medicines m ON m.id = r."medicineId"
          WHERE ${live} AND r."registrationNumber" ILIKE ${raw.trim() + '%'}
          ORDER BY r."registrationNumber" LIMIT 12`);
        break;
    }
    return rows.map((r) => ({ value: r.value, label: r.label, secondary: r.secondary, count: Number(r.count) }));
  }

  /** Ingredient names in one language, chosen from language-tagged synonyms (abbreviations excluded). */
  async ingredientNames(lang: string): Promise<IngredientNames> {
    const language = lang.slice(0, 2).toLowerCase();
    const rows = await this.prisma.$queryRaw<{ id: string; name: string; local: string }[]>(Prisma.sql`
      SELECT DISTINCT ON (ai.id) ai.id, ai.name, s.name AS local
      FROM active_ingredients ai JOIN ingredient_synonyms s ON s."ingredientId" = ai.id
      WHERE s.language = ${language} AND length(s.name) >= 4 AND s.name <> upper(s.name)
      ORDER BY ai.id, length(s.name) DESC`);
    return {
      byId: Object.fromEntries(rows.map((r) => [r.id, r.local])),
      byName: Object.fromEntries(rows.map((r) => [r.name, r.local])),
    };
  }
}
