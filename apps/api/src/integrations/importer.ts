import type { DocumentKind, PrescriptionStatus, PriceType, ReleaseMechanism, Verification } from '@prisma/client';
import { normalizeText } from '@meddexa/shared';
import { refreshSearchText } from '../medicines/search-text';
import type { PrismaService } from '../prisma/prisma.service';

export interface ImportedIngredient {
  name: string;
  moietyName?: string | null;
  amount: number | null;
  unit: string | null;
  perAmount?: number | null;
  perUnit?: string | null;
  basis?: 'SUBSTANCE' | 'MOIETY';
}

export interface ImportedPackage {
  description: string;
  quantity: number | null;
  unit: string | null;
  barcode?: string | null;
  registrationNumber?: string | null;
  price?: { amount: number; currency: string; priceType: PriceType; observedAt: Date } | null;
}

export interface ImportedMedicine {
  sourceReference: string;
  name: string;
  brand?: string | null;
  manufacturerName?: string | null;
  countryCode: string;
  authority: string;
  registrationNumber?: string | null;
  registrationStatus: 'AUTHORISED' | 'SUSPENDED' | 'WITHDRAWN' | 'UNKNOWN';
  authorisedAt?: Date | null;
  atcCode?: string | null;
  formCode: string | null;
  route: string | null;
  release: ReleaseMechanism;
  prescription: PrescriptionStatus;
  ingredients: ImportedIngredient[];
  packages: ImportedPackage[];
  documents?: { kind: DocumentKind; title: string; language: string; url: string }[];
  imageUrl?: string | null;
}

async function findOrCreateIngredient(prisma: PrismaService, name: string, moietyId?: string | null) {
  const normalizedName = normalizeText(name);
  const direct = await prisma.activeIngredient.findUnique({ where: { normalizedName } });
  if (direct) return direct;
  const synonym = await prisma.ingredientSynonym.findFirst({ where: { normalizedName }, include: { ingredient: true } });
  if (synonym) return synonym.ingredient;
  return prisma.activeIngredient.create({
    data: { name: name.toLowerCase(), normalizedName, moietyId: moietyId ?? undefined },
  });
}

/**
 * Upserts one product from an official source. Identity is (sourceId, sourceReference);
 * cross-source duplicates are surfaced to editors by the duplicate detector rather than
 * merged automatically, because similar names never prove identical medicines.
 */
export async function upsertImportedMedicine(
  prisma: PrismaService,
  sourceId: string,
  input: ImportedMedicine,
  verification: Verification = 'VERIFIED',
): Promise<'created' | 'updated'> {
  const now = new Date();
  let manufacturerId: string | undefined;
  if (input.manufacturerName) {
    const normalizedName = normalizeText(input.manufacturerName);
    manufacturerId = (
      await prisma.manufacturer.upsert({
        where: { normalizedName },
        update: {},
        create: { name: input.manufacturerName.trim(), normalizedName, countryCode: null },
      })
    ).id;
  }
  const atc = input.atcCode ? await prisma.atcClass.findUnique({ where: { code: input.atcCode } }) : null;
  const form = input.formCode ? await prisma.pharmaceuticalForm.findUnique({ where: { code: input.formCode } }) : null;

  const where = { sourceId_sourceReference: { sourceId, sourceReference: input.sourceReference } };
  const existing = await prisma.medicine.findUnique({ where });
  const data = {
    name: input.name,
    normalizedName: normalizeText(input.name),
    brand: input.brand ?? null,
    manufacturerId,
    atcCode: atc?.code ?? null,
    formCode: form?.code ?? null,
    route: input.route,
    release: input.release,
    prescription: input.prescription,
    countryCode: input.countryCode,
    imageUrl: input.imageUrl ?? null,
    syncedAt: now,
    verification,
    confidence: 1,
  };
  const medicine = existing
    ? await prisma.medicine.update({ where: { id: existing.id }, data })
    : await prisma.medicine.create({ data: { ...data, sourceId, sourceReference: input.sourceReference } });

  // Ingredients: replace with the source's current composition.
  await prisma.ingredientQuantity.deleteMany({ where: { medicineId: medicine.id } });
  const seen = new Set<string>();
  for (const [position, ing] of input.ingredients.entries()) {
    const moiety = ing.moietyName ? await findOrCreateIngredient(prisma, ing.moietyName) : null;
    const substance = await findOrCreateIngredient(prisma, ing.name, moiety && moiety.normalizedName !== normalizeText(ing.name) ? moiety.id : null);
    if (seen.has(substance.id)) continue;
    seen.add(substance.id);
    await prisma.ingredientQuantity.create({
      data: {
        medicineId: medicine.id,
        ingredientId: substance.id,
        amount: ing.amount,
        unit: ing.unit,
        perAmount: ing.perAmount ?? null,
        perUnit: ing.perUnit ?? null,
        basis: ing.basis ?? 'SUBSTANCE',
        position,
      },
    });
  }

  if (input.registrationNumber) {
    await prisma.productRegistration.upsert({
      where: { countryCode_registrationNumber: { countryCode: input.countryCode, registrationNumber: input.registrationNumber } },
      update: { localName: input.name, status: input.registrationStatus, syncedAt: now, medicineId: medicine.id },
      create: {
        medicineId: medicine.id,
        countryCode: input.countryCode,
        authority: input.authority,
        registrationNumber: input.registrationNumber,
        localName: input.name,
        status: input.registrationStatus,
        authorisedAt: input.authorisedAt ?? null,
        sourceId,
        sourceReference: input.sourceReference,
        syncedAt: now,
        verification,
      },
    });
  }

  for (const [i, p] of input.packages.entries()) {
    if (p.quantity == null || !p.unit) continue;
    let pkg = await prisma.medicinePackage.findFirst({
      where: { medicineId: medicine.id, OR: [{ barcode: p.barcode ?? '__none__' }, { description: p.description }] },
    });
    pkg ??= await prisma.medicinePackage.create({
      data: {
        medicineId: medicine.id,
        quantity: p.quantity,
        unit: p.unit,
        description: p.description,
        barcode: p.barcode ?? null,
        registrationNumber: p.registrationNumber ?? null,
        isDefault: i === 0,
      },
    });
    if (p.price) {
      // Country-level price-list entry (no pharmacy). NULL pharmacyId is not usable in a
      // compound unique lookup, so look it up explicitly.
      const offer =
        (await prisma.pharmacyOffer.findFirst({ where: { packageId: pkg.id, pharmacyId: null, sourceId } })) ??
        (await prisma.pharmacyOffer.create({
          data: { packageId: pkg.id, pharmacyId: null, countryCode: input.countryCode, sourceId, sourceReference: p.barcode ?? p.description },
        }));
      const previous = await prisma.price.findUnique({ where: { offerId: offer.id } });
      await prisma.price.upsert({
        where: { offerId: offer.id },
        update: { amount: p.price.amount, currency: p.price.currency, priceType: p.price.priceType, observedAt: p.price.observedAt, verification },
        create: { offerId: offer.id, amount: p.price.amount, currency: p.price.currency, priceType: p.price.priceType, observedAt: p.price.observedAt, verification },
      });
      if (!previous || Number(previous.amount) !== p.price.amount) {
        await prisma.priceSnapshot.upsert({
          where: { offerId_capturedAt: { offerId: offer.id, capturedAt: p.price.observedAt } },
          update: { amount: p.price.amount },
          create: { offerId: offer.id, amount: p.price.amount, currency: p.price.currency, capturedAt: p.price.observedAt },
        });
      }
    }
  }

  for (const doc of input.documents ?? []) {
    const exists = await prisma.medicineDocument.findFirst({ where: { medicineId: medicine.id, url: doc.url } });
    if (!exists) {
      await prisma.medicineDocument.create({
        data: { ...doc, medicineId: medicine.id, countryCode: input.countryCode, sourceId, syncedAt: now, verification },
      });
    }
  }

  await refreshSearchText(prisma, medicine.id);
  return existing ? 'updated' : 'created';
}
