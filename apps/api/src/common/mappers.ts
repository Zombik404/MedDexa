import { Prisma } from '@prisma/client';
import {
  formatStrength,
  type ComparableMedicine,
  type IngredientView,
  type MedicineSummary,
  type Provenance,
  type VerificationStatus,
} from '@meddexa/shared';

export const medicineInclude = {
  manufacturer: true,
  form: true,
  source: true,
  ingredients: { include: { ingredient: { include: { moiety: true } } }, orderBy: { position: 'asc' } },
  packages: { orderBy: [{ isDefault: 'desc' }, { quantity: 'asc' }] },
} satisfies Prisma.MedicineInclude;

export type MedicineWithRelations = Prisma.MedicineGetPayload<{ include: typeof medicineInclude }>;

const num = (d: Prisma.Decimal | null | undefined): number | null => (d == null ? null : Number(d));

export function toIngredientViews(m: MedicineWithRelations): IngredientView[] {
  return m.ingredients.map((iq) => {
    const view: IngredientView = {
      substanceId: iq.ingredient.id,
      substanceName: iq.ingredient.name,
      moietyId: iq.ingredient.moiety?.id ?? null,
      moietyName: iq.ingredient.moiety?.name ?? null,
      amount: num(iq.amount),
      unit: iq.unit,
      perAmount: num(iq.perAmount),
      perUnit: iq.perUnit,
      basis: iq.basis,
      display: null,
    };
    view.display = formatStrength({
      substanceId: view.substanceId,
      substanceName: view.substanceName,
      strength: { amount: view.amount, unit: view.unit, perAmount: view.perAmount, perUnit: view.perUnit },
    });
    return view;
  });
}

export function defaultPackage(m: MedicineWithRelations) {
  const p = m.packages[0];
  return p ? { quantity: Number(p.quantity), unit: p.unit } : null;
}

export function toMedicineSummary(
  m: MedicineWithRelations,
  extra: { rating?: MedicineSummary['rating']; lowestPrice?: MedicineSummary['lowestPrice'] } = {},
): MedicineSummary {
  return {
    id: m.id,
    name: m.name,
    brand: m.brand,
    manufacturer: m.manufacturer?.name ?? null,
    countryCode: m.countryCode,
    atcCode: m.atcCode,
    form: m.form ? { code: m.form.code, name: m.form.name, group: m.form.group } : null,
    route: m.route,
    release: m.release,
    prescription: m.prescription,
    packageSize: defaultPackage(m),
    ingredients: toIngredientViews(m),
    imageUrl: m.imageUrl,
    rating: extra.rating ?? null,
    lowestPrice: extra.lowestPrice ?? null,
    isDemo: m.isDemo,
  };
}

/** Converts a stored medicine into the comparison engine's input. Unknowns stay null. */
export function toComparable(m: MedicineWithRelations): ComparableMedicine {
  return {
    id: m.id,
    name: m.name,
    brand: m.brand,
    manufacturer: m.manufacturer?.name ?? null,
    countryCode: m.countryCode,
    atcCode: m.atcCode,
    form: m.form ? { code: m.form.code, name: m.form.name, group: m.form.group } : null,
    route: m.route,
    release: m.release,
    prescription: m.prescription,
    packageSize: defaultPackage(m),
    ingredients: m.ingredients.map((iq) => ({
      substanceId: iq.ingredient.id,
      substanceName: iq.ingredient.name,
      moietyId: iq.ingredient.moietyId ?? iq.ingredient.id,
      moietyName: iq.ingredient.moiety?.name ?? iq.ingredient.name,
      strength: {
        amount: num(iq.amount),
        unit: iq.unit,
        perAmount: num(iq.perAmount),
        perUnit: iq.perUnit,
        basis: iq.basis,
      },
    })),
  };
}

export function toProvenance(
  r: {
    sourceId: string | null;
    sourceReference?: string | null;
    syncedAt?: Date | null;
    verification: VerificationStatus;
    confidence?: number | null;
    isDemo?: boolean;
  },
  source: { name: string; countryCode: string | null; isDemo?: boolean } | null | undefined,
  countryCode: string | null = null,
): Provenance {
  return {
    sourceId: r.sourceId ?? 'manual',
    sourceName: source?.name ?? 'MedDexa editorial team',
    sourceReference: r.sourceReference ?? null,
    countryCode: countryCode ?? source?.countryCode ?? null,
    syncedAt: r.syncedAt?.toISOString() ?? null,
    verification: r.verification,
    confidence: r.confidence ?? null,
    isDemo: r.isDemo ?? r.verification === 'DEMO',
  };
}
