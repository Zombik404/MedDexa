import type { Prisma, PrismaClient } from '@prisma/client';
import { normalizeText } from '@meddexa/shared';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Builds the denormalised search document of a medicine: names in every country,
 * brand, manufacturer, ATC, form, ingredients with their synonyms and moieties,
 * strengths ("400 mg" and "400mg"), barcodes and registration numbers.
 * The tsvector column and trigram index are derived from it by PostgreSQL.
 */
export async function refreshSearchText(db: Db, medicineId: string): Promise<string> {
  const m = await db.medicine.findUniqueOrThrow({
    where: { id: medicineId },
    include: {
      manufacturer: true,
      atc: true,
      form: true,
      synonyms: true,
      registrations: true,
      packages: true,
      ingredients: {
        include: { ingredient: { include: { synonyms: true, moiety: { include: { synonyms: true } } } } },
      },
    },
  });

  const parts: (string | null | undefined)[] = [
    m.name,
    m.brand,
    m.manufacturer?.name,
    m.atcCode,
    m.atc?.name,
    m.form?.name,
  ];
  for (const iq of m.ingredients) {
    const ing = iq.ingredient;
    parts.push(ing.name, ...ing.synonyms.map((s) => s.name));
    if (ing.moiety) parts.push(ing.moiety.name, ...ing.moiety.synonyms.map((s) => s.name));
    if (iq.amount != null && iq.unit) {
      const amount = Number(iq.amount);
      parts.push(`${amount} ${iq.unit}`, `${amount}${iq.unit}`);
    }
  }
  parts.push(...m.synonyms.map((s) => s.name));
  for (const r of m.registrations) parts.push(r.localName, r.registrationNumber);
  for (const p of m.packages) parts.push(p.barcode, p.registrationNumber);

  const text = [...new Set(parts.filter((p): p is string => !!p).map(normalizeText))].join(' ');
  await db.medicine.update({ where: { id: medicineId }, data: { searchText: text } });
  return text;
}
