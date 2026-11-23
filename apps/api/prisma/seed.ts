/**
 * Seeds reference data (all environments) and, when SEED_DEMO=true outside production,
 * clearly labelled demonstration data.
 *
 * Demonstration data uses fictional brand names, fictional manufacturers and fictional
 * pharmacies. Every demo record has isDemo=true and verification=DEMO and is shown with
 * a "Demo data" label in the apps. No reviews are seeded: MedDexa never fabricates reviews.
 */
import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { normalizeText } from '@meddexa/shared';
import { ATC, COUNTRIES, CURRENCIES, DATA_SOURCES, FORMS, LANGUAGES, SERVICES } from './reference-data';
import { refreshSearchText } from '../src/medicines/search-text';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function seedReference() {
  for (const c of CURRENCIES) await prisma.currency.upsert({ where: { code: c.code }, update: c, create: c });
  for (const l of LANGUAGES) await prisma.language.upsert({ where: { code: l.code }, update: l, create: l });
  for (const c of COUNTRIES) await prisma.country.upsert({ where: { code: c.code }, update: c, create: c });
  for (const f of FORMS) await prisma.pharmaceuticalForm.upsert({ where: { code: f.code }, update: f, create: f });
  for (const s of SERVICES) await prisma.pharmacyService.upsert({ where: { code: s.code }, update: s, create: s });
  for (const [code, name, level, parentCode] of ATC) {
    await prisma.atcClass.upsert({
      where: { code },
      update: { name, level, parentCode },
      create: { code, name, level, parentCode },
    });
  }
  for (const d of DATA_SOURCES) {
    const data = { ...d, isDemo: d.id === 'demo' };
    await prisma.dataSource.upsert({
      where: { id: d.id },
      update: { name: data.name, url: data.url, licence: data.licence, attribution: data.attribution },
      create: data as Prisma.DataSourceUncheckedCreateInput,
    });
  }
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin account.');
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { role: 'ADMIN' },
    create: {
      email: email.toLowerCase(),
      passwordHash,
      displayName: 'Administrator',
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
      preferences: { create: {} },
    },
  });
  console.log(`Admin account ready: ${email}`);
}

// ───────────────────────────── Demo data ─────────────────────────────

const DEMO = { sourceId: 'demo', verification: 'DEMO' as const, isDemo: true };

const INGREDIENTS: { key: string; name: string; moiety?: string; synonyms: [string, string | null][] }[] = [
  { key: 'ibuprofen', name: 'ibuprofen', synonyms: [['Ibuprofen', 'de'], ['ibuprofén', 'hu'], ['ibuprofeno', 'es']] },
  { key: 'ibuprofen-lysine', name: 'ibuprofen lysine', moiety: 'ibuprofen', synonyms: [['ibuprofen lizyna', 'pl']] },
  {
    key: 'paracetamol',
    name: 'paracetamol',
    synonyms: [['acetaminophen', 'en'], ['paracétamol', 'fr'], ['paracetamolo', 'it'], ['APAP', null]],
  },
  { key: 'caffeine', name: 'caffeine', synonyms: [['koffein', 'hu'], ['Coffein', 'de'], ['caféine', 'fr'], ['cafeína', 'es']] },
  {
    key: 'asa',
    name: 'acetylsalicylic acid',
    synonyms: [['aspirin', 'en'], ['ASS', 'de'], ['acetilszalicilsav', 'hu'], ['acido acetilsalicilico', 'it']],
  },
  { key: 'diclofenac', name: 'diclofenac', synonyms: [['diklofenak', 'pl'], ['diclofénac', 'fr']] },
  { key: 'diclofenac-sodium', name: 'diclofenac sodium', moiety: 'diclofenac', synonyms: [['Diclofenac-Natrium', 'de']] },
  { key: 'diclofenac-diethylamine', name: 'diclofenac diethylamine', moiety: 'diclofenac', synonyms: [] },
  { key: 'cetirizine', name: 'cetirizine', synonyms: [['cetirizin', 'hu']] },
  { key: 'cetirizine-2hcl', name: 'cetirizine dihydrochloride', moiety: 'cetirizine', synonyms: [] },
  { key: 'loratadine', name: 'loratadine', synonyms: [['loratadin', 'de']] },
  { key: 'omeprazole', name: 'omeprazole', synonyms: [['omeprazol', 'es']] },
  { key: 'pseudoephedrine', name: 'pseudoephedrine', synonyms: [] },
  { key: 'pseudoephedrine-hcl', name: 'pseudoephedrine hydrochloride', moiety: 'pseudoephedrine', synonyms: [] },
];

const MANUFACTURERS = ['Dexalis Pharma (demo)', 'Nordvale Laboratories (demo)', 'Helvion Generics (demo)', 'Aurelis Health (demo)'];

interface DemoMedicine {
  key: string;
  name: string;
  brand: string;
  manufacturer: number;
  atc: string;
  form: string;
  route: string;
  release: 'IMMEDIATE' | 'PROLONGED' | 'GASTRO_RESISTANT' | 'MODIFIED';
  rx: 'RX' | 'OTC' | 'PHARMACY_ONLY';
  country: string;
  ingredients: { ing: string; amount: number; unit: string; per?: number; perUnit?: string; basis?: 'MOIETY' }[];
  packs: { qty: number; unit: string; barcode?: string }[];
  registrations: { country: string; localName: string; number: string }[];
  /** Base retail price per pack (first pack) in EUR, before country factor. */
  eur: number;
  duplicateOf?: string;
}

const MEDICINES: DemoMedicine[] = [
  {
    key: 'ibudex-200', name: 'Ibudex 200 mg film-coated tablets', brand: 'Ibudex', manufacturer: 0, atc: 'M01AE01',
    form: 'FILM_COATED_TABLET', route: 'ORAL', release: 'IMMEDIATE', rx: 'OTC', country: 'HU',
    ingredients: [{ ing: 'ibuprofen', amount: 200, unit: 'mg' }],
    packs: [{ qty: 20, unit: 'tablet', barcode: '5990000000017' }, { qty: 50, unit: 'tablet', barcode: '5990000000024' }],
    registrations: [
      { country: 'HU', localName: 'Ibudex 200 mg filmtabletta', number: 'OGYI-T-DEMO-0001' },
      { country: 'AT', localName: 'Ibudex 200 mg Filmtabletten', number: 'DEMO-AT-10001' },
    ],
    eur: 3.2,
  },
  {
    key: 'ibudex-400', name: 'Ibudex 400 mg film-coated tablets', brand: 'Ibudex', manufacturer: 0, atc: 'M01AE01',
    form: 'FILM_COATED_TABLET', route: 'ORAL', release: 'IMMEDIATE', rx: 'OTC', country: 'HU',
    ingredients: [{ ing: 'ibuprofen', amount: 400, unit: 'mg' }],
    packs: [{ qty: 20, unit: 'tablet', barcode: '5990000000031' }],
    registrations: [{ country: 'HU', localName: 'Ibudex 400 mg filmtabletta', number: 'OGYI-T-DEMO-0002' }],
    eur: 4.6,
  },
  {
    key: 'profenil-400', name: 'Profenil 400 mg tablets', brand: 'Profenil', manufacturer: 1, atc: 'M01AE01',
    form: 'TABLET', route: 'ORAL', release: 'IMMEDIATE', rx: 'PHARMACY_ONLY', country: 'DE',
    ingredients: [{ ing: 'ibuprofen', amount: 400, unit: 'mg' }],
    packs: [{ qty: 20, unit: 'tablet', barcode: '4000000000013' }, { qty: 50, unit: 'tablet' }],
    registrations: [
      { country: 'DE', localName: 'Profenil 400 mg Tabletten', number: 'DEMO-DE-20001' },
      { country: 'AT', localName: 'Profenil 400 mg Tabletten', number: 'DEMO-AT-20001' },
      { country: 'PL', localName: 'Profenil 400 mg tabletki', number: 'DEMO-PL-20001' },
    ],
    eur: 5.1,
  },
  {
    key: 'ibudex-junior', name: 'Ibudex Junior 100 mg/5 ml oral suspension', brand: 'Ibudex Junior', manufacturer: 0,
    atc: 'M01AE01', form: 'ORAL_SUSPENSION', route: 'ORAL', release: 'IMMEDIATE', rx: 'OTC', country: 'HU',
    ingredients: [{ ing: 'ibuprofen', amount: 100, unit: 'mg', per: 5, perUnit: 'ml' }],
    packs: [{ qty: 100, unit: 'ml', barcode: '5990000000048' }],
    registrations: [{ country: 'HU', localName: 'Ibudex Junior 100 mg/5 ml belsőleges szuszpenzió', number: 'OGYI-T-DEMO-0003' }],
    eur: 4.9,
  },
  {
    key: 'ibudex-gel', name: 'Ibudex 5% gel', brand: 'Ibudex Gel', manufacturer: 0, atc: 'M02AA13',
    form: 'GEL', route: 'CUTANEOUS', release: 'IMMEDIATE', rx: 'OTC', country: 'AT',
    ingredients: [{ ing: 'ibuprofen', amount: 5, unit: '%' }],
    packs: [{ qty: 50, unit: 'g' }, { qty: 100, unit: 'g' }],
    registrations: [{ country: 'AT', localName: 'Ibudex 5% Gel', number: 'DEMO-AT-10002' }],
    eur: 6.4,
  },
  {
    key: 'lysiprofen', name: 'Lysiprofen 684 mg film-coated tablets', brand: 'Lysiprofen', manufacturer: 2,
    atc: 'M01AE01', form: 'FILM_COATED_TABLET', route: 'ORAL', release: 'IMMEDIATE', rx: 'OTC', country: 'PL',
    ingredients: [{ ing: 'ibuprofen-lysine', amount: 684, unit: 'mg' }],
    packs: [{ qty: 12, unit: 'tablet' }],
    registrations: [{ country: 'PL', localName: 'Lysiprofen 684 mg tabletki powlekane', number: 'DEMO-PL-30001' }],
    eur: 5.8,
  },
  {
    key: 'ibudex-retard', name: 'Ibudex Retard 800 mg prolonged-release tablets', brand: 'Ibudex Retard',
    manufacturer: 0, atc: 'M01AE01', form: 'PROLONGED_RELEASE_TABLET', route: 'ORAL', release: 'PROLONGED',
    rx: 'RX', country: 'DE',
    ingredients: [{ ing: 'ibuprofen', amount: 800, unit: 'mg' }],
    packs: [{ qty: 20, unit: 'tablet' }],
    registrations: [{ country: 'DE', localName: 'Ibudex Retard 800 mg Retardtabletten', number: 'DEMO-DE-10003' }],
    eur: 11.9,
  },
  {
    key: 'paradex-500', name: 'Paradex 500 mg tablets', brand: 'Paradex', manufacturer: 1, atc: 'N02BE01',
    form: 'TABLET', route: 'ORAL', release: 'IMMEDIATE', rx: 'OTC', country: 'HU',
    ingredients: [{ ing: 'paracetamol', amount: 500, unit: 'mg' }],
    packs: [{ qty: 20, unit: 'tablet', barcode: '5990000000055' }, { qty: 30, unit: 'tablet' }],
    registrations: [
      { country: 'HU', localName: 'Paradex 500 mg tabletta', number: 'OGYI-T-DEMO-0004' },
      { country: 'DE', localName: 'Paradex 500 mg Tabletten', number: 'DEMO-DE-20002' },
      { country: 'AT', localName: 'Paradex 500 mg Tabletten', number: 'DEMO-AT-20002' },
      { country: 'PL', localName: 'Paradex 500 mg tabletki', number: 'DEMO-PL-20002' },
      { country: 'CZ', localName: 'Paradex 500 mg tablety', number: 'DEMO-CZ-20002' },
      { country: 'SK', localName: 'Paradex 500 mg tablety', number: 'DEMO-SK-20002' },
    ],
    eur: 2.4,
  },
  {
    key: 'paradex-plus', name: 'Paradex Plus 500 mg/65 mg tablets', brand: 'Paradex Plus', manufacturer: 1,
    atc: 'N02BE51', form: 'TABLET', route: 'ORAL', release: 'IMMEDIATE', rx: 'OTC', country: 'HU',
    ingredients: [
      { ing: 'paracetamol', amount: 500, unit: 'mg' },
      { ing: 'caffeine', amount: 65, unit: 'mg' },
    ],
    packs: [{ qty: 24, unit: 'tablet' }],
    registrations: [
      { country: 'HU', localName: 'Paradex Plus 500 mg/65 mg tabletta', number: 'OGYI-T-DEMO-0005' },
      { country: 'RO', localName: 'Paradex Plus 500 mg/65 mg comprimate', number: 'DEMO-RO-20003' },
    ],
    eur: 4.1,
  },
  {
    key: 'cefadex', name: 'Cefadex 500 mg/65 mg film-coated tablets', brand: 'Cefadex', manufacturer: 3,
    atc: 'N02BE51', form: 'FILM_COATED_TABLET', route: 'ORAL', release: 'IMMEDIATE', rx: 'OTC', country: 'FR',
    ingredients: [
      { ing: 'paracetamol', amount: 500, unit: 'mg' },
      { ing: 'caffeine', amount: 65, unit: 'mg' },
    ],
    packs: [{ qty: 16, unit: 'tablet' }],
    registrations: [
      { country: 'FR', localName: 'Cefadex 500 mg/65 mg comprimé pelliculé', number: 'DEMO-FR-40001' },
      { country: 'BE', localName: 'Cefadex 500 mg/65 mg filmomhulde tabletten', number: 'DEMO-BE-40001' },
    ],
    eur: 3.9,
  },
  {
    key: 'paradex-1000', name: 'Paradex 1000 mg effervescent tablets', brand: 'Paradex', manufacturer: 1,
    atc: 'N02BE01', form: 'EFFERVESCENT_TABLET', route: 'ORAL', release: 'IMMEDIATE', rx: 'PHARMACY_ONLY', country: 'ES',
    ingredients: [{ ing: 'paracetamol', amount: 1, unit: 'g' }],
    packs: [{ qty: 20, unit: 'tablet' }],
    registrations: [{ country: 'ES', localName: 'Paradex 1 g comprimidos efervescentes', number: 'DEMO-ES-20004' }],
    eur: 3.6,
  },
  {
    key: 'paradex-cold', name: 'Paradex Cold 500 mg/30 mg tablets', brand: 'Paradex Cold', manufacturer: 1,
    atc: 'N02BE51', form: 'TABLET', route: 'ORAL', release: 'IMMEDIATE', rx: 'PHARMACY_ONLY', country: 'PT',
    ingredients: [
      { ing: 'paracetamol', amount: 500, unit: 'mg' },
      { ing: 'pseudoephedrine-hcl', amount: 30, unit: 'mg' },
    ],
    packs: [{ qty: 20, unit: 'tablet' }],
    registrations: [{ country: 'PT', localName: 'Paradex Cold 500 mg/30 mg comprimidos', number: 'DEMO-PT-20005' }],
    eur: 5.2,
  },
  {
    key: 'aspidex', name: 'Aspidex 500 mg tablets', brand: 'Aspidex', manufacturer: 2, atc: 'N02BA01',
    form: 'TABLET', route: 'ORAL', release: 'IMMEDIATE', rx: 'OTC', country: 'IT',
    ingredients: [{ ing: 'asa', amount: 500, unit: 'mg' }],
    packs: [{ qty: 20, unit: 'tablet' }],
    registrations: [{ country: 'IT', localName: 'Aspidex 500 mg compresse', number: 'DEMO-IT-30002' }],
    eur: 4.4,
  },
  {
    key: 'dicladex-50', name: 'Dicladex 50 mg gastro-resistant tablets', brand: 'Dicladex', manufacturer: 2,
    atc: 'M01AB05', form: 'GASTRO_RESISTANT_TABLET', route: 'ORAL', release: 'GASTRO_RESISTANT', rx: 'RX', country: 'CZ',
    ingredients: [{ ing: 'diclofenac-sodium', amount: 50, unit: 'mg' }],
    packs: [{ qty: 20, unit: 'tablet' }],
    registrations: [
      { country: 'CZ', localName: 'Dicladex 50 mg enterosolventní tablety', number: 'DEMO-CZ-30003' },
      { country: 'SK', localName: 'Dicladex 50 mg gastrorezistentné tablety', number: 'DEMO-SK-30003' },
    ],
    eur: 3.1,
  },
  {
    key: 'dicladex-gel', name: 'Dicladex 1.16% gel', brand: 'Dicladex Gel', manufacturer: 2, atc: 'M02AA15',
    form: 'GEL', route: 'CUTANEOUS', release: 'IMMEDIATE', rx: 'OTC', country: 'SK',
    ingredients: [{ ing: 'diclofenac-diethylamine', amount: 1.16, unit: '%' }],
    packs: [{ qty: 100, unit: 'g' }],
    registrations: [{ country: 'SK', localName: 'Dicladex 1,16 % gél', number: 'DEMO-SK-30004' }],
    eur: 8.7,
  },
  {
    key: 'cetidex', name: 'Cetidex 10 mg film-coated tablets', brand: 'Cetidex', manufacturer: 3, atc: 'R06AE07',
    form: 'FILM_COATED_TABLET', route: 'ORAL', release: 'IMMEDIATE', rx: 'OTC', country: 'RO',
    ingredients: [{ ing: 'cetirizine-2hcl', amount: 10, unit: 'mg' }],
    packs: [{ qty: 10, unit: 'tablet' }, { qty: 30, unit: 'tablet' }],
    registrations: [
      { country: 'RO', localName: 'Cetidex 10 mg comprimate filmate', number: 'DEMO-RO-40002' },
      { country: 'HU', localName: 'Cetidex 10 mg filmtabletta', number: 'OGYI-T-DEMO-0006' },
    ],
    eur: 2.9,
  },
  {
    key: 'lordex', name: 'Lordex 10 mg tablets', brand: 'Lordex', manufacturer: 3, atc: 'R06AX13',
    form: 'TABLET', route: 'ORAL', release: 'IMMEDIATE', rx: 'OTC', country: 'NL',
    ingredients: [{ ing: 'loratadine', amount: 10, unit: 'mg' }],
    packs: [{ qty: 30, unit: 'tablet' }],
    registrations: [{ country: 'NL', localName: 'Lordex 10 mg tabletten', number: 'DEMO-NL-40003' }],
    eur: 4.3,
  },
  {
    key: 'omedex', name: 'Omedex 20 mg gastro-resistant capsules', brand: 'Omedex', manufacturer: 0, atc: 'A02BC01',
    form: 'GASTRO_RESISTANT_CAPSULE', route: 'ORAL', release: 'GASTRO_RESISTANT', rx: 'PHARMACY_ONLY', country: 'BE',
    ingredients: [{ ing: 'omeprazole', amount: 20, unit: 'mg' }],
    packs: [{ qty: 14, unit: 'capsule' }, { qty: 28, unit: 'capsule' }],
    registrations: [{ country: 'BE', localName: 'Omedex 20 mg maagsapresistente capsules', number: 'DEMO-BE-10004' }],
    eur: 6.9,
  },
  {
    // Deliberate duplicate of ibudex-200 imported from another demo feed, to exercise
    // duplicate detection in the admin dashboard.
    key: 'ibudex-200-dup', name: 'IBUDEX 200MG FILMTABL.', brand: 'Ibudex', manufacturer: 0, atc: 'M01AE01',
    form: 'FILM_COATED_TABLET', route: 'ORAL', release: 'IMMEDIATE', rx: 'OTC', country: 'HU',
    ingredients: [{ ing: 'ibuprofen', amount: 200, unit: 'mg' }],
    packs: [{ qty: 20, unit: 'tablet' }],
    registrations: [],
    eur: 3.2,
  },
];

/** Relative price level per market for the fictional price lists. */
const MARKET_FACTOR: Record<string, number> = {
  HU: 1.0, DE: 1.35, AT: 1.3, PL: 0.85, FR: 1.1, ES: 0.95, IT: 1.15, NL: 1.25, BE: 1.2, PT: 0.9, RO: 0.8, CZ: 0.9, SK: 0.95,
};

/** Development fallback FX rates (approximate, labelled as demo). Live rates come from the ECB adapter. */
const DEMO_RATES: Record<string, number> = {
  HUF: 395, PLN: 4.25, CZK: 25.1, RON: 5.0, GBP: 0.86, CHF: 0.94, SEK: 11.2, DKK: 7.46, NOK: 11.6, BGN: 1.9558, UAH: 47.5, USD: 1.12,
};

const PHARMACIES: [string, string, string, string, string, number, number][] = [
  // country, city, name, street, postcode, lat, lng — fictional pharmacies at public street locations
  ['HU', 'Budapest', 'Demo Pharmacy Andrássy', 'Andrássy út 21', '1061', 47.5031, 19.0596],
  ['HU', 'Budapest', 'Demo Pharmacy Váci utca', 'Váci utca 12', '1052', 47.4949, 19.0525],
  ['HU', 'Budapest', 'Demo Pharmacy Margit körút', 'Margit körút 50', '1027', 47.5114, 19.0329],
  ['HU', 'Budapest', 'Demo Pharmacy Bartók Béla', 'Bartók Béla út 35', '1114', 47.4776, 19.0505],
  ['HU', 'Debrecen', 'Demo Pharmacy Piac utca', 'Piac utca 20', '4024', 47.5296, 21.6262],
  ['AT', 'Wien', 'Demo Apotheke Mariahilf', 'Mariahilfer Straße 80', '1070', 48.1979, 16.3485],
  ['AT', 'Wien', 'Demo Apotheke Stephansplatz', 'Stephansplatz 4', '1010', 48.2085, 16.3725],
  ['AT', 'Graz', 'Demo Apotheke Herrengasse', 'Herrengasse 7', '8010', 47.0707, 15.4395],
  ['DE', 'Berlin', 'Demo Apotheke Friedrichstraße', 'Friedrichstraße 120', '10117', 52.5246, 13.3880],
  ['DE', 'Berlin', 'Demo Apotheke Kastanienallee', 'Kastanienallee 30', '10435', 52.5385, 13.4097],
  ['DE', 'München', 'Demo Apotheke Marienplatz', 'Marienplatz 8', '80331', 48.1372, 11.5755],
  ['PL', 'Warszawa', 'Demo Apteka Nowy Świat', 'Nowy Świat 40', '00-363', 52.2338, 21.0187],
  ['PL', 'Kraków', 'Demo Apteka Floriańska', 'Floriańska 15', '31-019', 50.0634, 19.9395],
  ['FR', 'Paris', 'Pharmacie Démo Rivoli', 'Rue de Rivoli 90', '75004', 48.8573, 2.3497],
  ['FR', 'Lyon', 'Pharmacie Démo Bellecour', 'Place Bellecour 10', '69002', 45.7578, 4.8320],
  ['ES', 'Madrid', 'Farmacia Demo Gran Vía', 'Gran Vía 30', '28013', 40.4200, -3.7025],
  ['ES', 'Barcelona', 'Farmacia Demo Rambla', 'La Rambla 70', '08002', 41.3809, 2.1735],
  ['IT', 'Roma', 'Farmacia Demo Corso', 'Via del Corso 150', '00186', 41.9009, 12.4806],
  ['NL', 'Amsterdam', 'Demo Apotheek Damrak', 'Damrak 60', '1012 LM', 52.3752, 4.8960],
  ['BE', 'Bruxelles', 'Pharmacie Démo Louise', 'Avenue Louise 100', '1050', 50.8310, 4.3605],
  ['PT', 'Lisboa', 'Farmácia Demo Chiado', 'Rua Garrett 50', '1200-204', 38.7108, -9.1420],
  ['RO', 'București', 'Farmacia Demo Victoriei', 'Calea Victoriei 60', '010083', 44.4380, 26.0960],
  ['CZ', 'Praha', 'Demo Lékárna Václavské', 'Václavské náměstí 40', '110 00', 50.0812, 14.4270],
  ['CZ', 'Brno', 'Demo Lékárna Náměstí Svobody', 'náměstí Svobody 10', '602 00', 49.1951, 16.6080],
  ['SK', 'Bratislava', 'Demo Lekáreň Obchodná', 'Obchodná 20', '811 06', 48.1476, 17.1075],
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

async function seedDemo() {
  const rand = seededRandom(42);
  const now = new Date();

  // FX fallback rates
  const rateDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (const [currency, rate] of Object.entries(DEMO_RATES)) {
    await prisma.exchangeRate.upsert({
      where: { currency_rateDate_sourceId: { currency, rateDate, sourceId: 'demo' } },
      update: { rate },
      create: { currency, rate, rateDate, sourceId: 'demo' },
    });
  }

  const ingredientIds = new Map<string, string>();
  for (const i of INGREDIENTS.filter((x) => !x.moiety).concat(INGREDIENTS.filter((x) => x.moiety))) {
    const rec = await prisma.activeIngredient.upsert({
      where: { normalizedName: normalizeText(i.name) },
      update: {},
      create: {
        name: i.name,
        normalizedName: normalizeText(i.name),
        moietyId: i.moiety ? ingredientIds.get(i.moiety) : undefined,
      },
    });
    ingredientIds.set(i.key, rec.id);
    for (const [name, language] of i.synonyms) {
      await prisma.ingredientSynonym.upsert({
        where: { ingredientId_normalizedName: { ingredientId: rec.id, normalizedName: normalizeText(name) } },
        update: {},
        create: { ingredientId: rec.id, name, normalizedName: normalizeText(name), language },
      });
    }
  }

  const manufacturerIds: string[] = [];
  for (const name of MANUFACTURERS) {
    const m = await prisma.manufacturer.upsert({
      where: { normalizedName: normalizeText(name) },
      update: {},
      create: { name, normalizedName: normalizeText(name) },
    });
    manufacturerIds.push(m.id);
  }

  // Pharmacies
  const pharmacyIds: { id: string; country: string }[] = [];
  for (const [idx, [country, city, name, street, postcode, lat, lng]] of PHARMACIES.entries()) {
    const ref = `demo-pharmacy-${idx + 1}`;
    const tz = (await prisma.country.findUniqueOrThrow({ where: { code: country } })).timezone;
    const p = await prisma.pharmacy.upsert({
      where: { sourceId_sourceReference: { sourceId: 'demo', sourceReference: ref } },
      update: {},
      create: {
        ...DEMO,
        sourceReference: ref,
        syncedAt: now,
        name,
        normalizedName: normalizeText(name),
        street,
        city,
        postcode,
        countryCode: country,
        lat,
        lng,
        timezone: tz,
        // Demo contact details use reserved example values and are flagged unverified,
        // so the apps hide call/website actions for them.
        phone: null,
        website: `https://example.org/demo-pharmacy-${idx + 1}`,
        websiteVerified: false,
        confidence: 0,
      },
    });
    pharmacyIds.push({ id: p.id, country });
    await prisma.openingHours.deleteMany({ where: { pharmacyId: p.id } });
    const hours = [];
    for (let day = 0; day < 7; day++) {
      if (day < 5) hours.push({ pharmacyId: p.id, day, opens: '08:00', closes: idx % 5 === 0 ? '22:00' : '19:00' });
      else if (day === 5) hours.push({ pharmacyId: p.id, day, opens: '09:00', closes: '14:00' });
      else if (idx % 4 === 0) hours.push({ pharmacyId: p.id, day, opens: '10:00', closes: '13:00' });
    }
    await prisma.openingHours.createMany({ data: hours });
    const services = SERVICES.filter((_, i) => (idx + i) % 3 === 0).map((s) => s.code);
    for (const serviceCode of services) {
      await prisma.pharmacyServiceLink.upsert({
        where: { pharmacyId_serviceCode: { pharmacyId: p.id, serviceCode } },
        update: {},
        create: { pharmacyId: p.id, serviceCode },
      });
    }
  }

  const countryCurrency = new Map(COUNTRIES.map((c) => [c.code, c.currencyCode]));
  const medicineIds = new Map<string, string>();

  for (const d of MEDICINES) {
    const m = await prisma.medicine.upsert({
      where: { sourceId_sourceReference: { sourceId: 'demo', sourceReference: d.key } },
      update: {},
      create: {
        ...DEMO,
        sourceReference: d.key,
        syncedAt: now,
        confidence: 0,
        name: d.name,
        normalizedName: normalizeText(d.name),
        brand: d.brand,
        manufacturerId: manufacturerIds[d.manufacturer],
        atcCode: d.atc,
        formCode: d.form,
        route: d.route,
        release: d.release,
        prescription: d.rx,
        countryCode: d.country,
        duplicateOfId: undefined,
      },
    });
    medicineIds.set(d.key, m.id);

    await prisma.ingredientQuantity.deleteMany({ where: { medicineId: m.id } });
    await prisma.ingredientQuantity.createMany({
      data: d.ingredients.map((i, position) => ({
        medicineId: m.id,
        ingredientId: ingredientIds.get(i.ing)!,
        amount: i.amount,
        unit: i.unit,
        perAmount: i.per ?? null,
        perUnit: i.perUnit ?? null,
        basis: i.basis ?? 'SUBSTANCE',
        position,
      })),
    });

    for (const r of d.registrations) {
      await prisma.productRegistration.upsert({
        where: { countryCode_registrationNumber: { countryCode: r.country, registrationNumber: r.number } },
        update: {},
        create: {
          medicineId: m.id,
          countryCode: r.country,
          authority: 'Demonstration registry',
          registrationNumber: r.number,
          localName: r.localName,
          status: 'AUTHORISED',
          sourceId: 'demo',
          syncedAt: now,
          verification: 'DEMO',
        },
      });
      await prisma.productSynonym.upsert({
        where: {
          medicineId_normalizedName_countryCode: {
            medicineId: m.id,
            normalizedName: normalizeText(r.localName),
            countryCode: r.country,
          },
        },
        update: {},
        create: {
          medicineId: m.id,
          name: r.localName,
          normalizedName: normalizeText(r.localName),
          countryCode: r.country,
          language: COUNTRIES.find((c) => c.code === r.country)?.defaultLanguage,
          kind: 'LOCAL_NAME',
        },
      });
    }

    // Placeholder product-information notice (never invented medical content).
    for (const kind of ['WARNINGS', 'CONTRAINDICATIONS', 'SIDE_EFFECTS'] as const) {
      await prisma.safetySection.upsert({
        where: { medicineId_kind_language_countryCode: { medicineId: m.id, kind, language: 'en', countryCode: d.country } },
        update: {},
        create: {
          medicineId: m.id,
          kind,
          language: 'en',
          countryCode: d.country,
          content:
            'Demonstration record. In production this section is loaded verbatim from the official Summary of Product Characteristics / Package Leaflet published by the national authority. Always read the leaflet of the product you use.',
          sourceId: 'demo',
          verification: 'DEMO',
        },
      });
    }

    const existingPackages = await prisma.medicinePackage.count({ where: { medicineId: m.id } });
    if (existingPackages === 0) {
      for (const [pi, pack] of d.packs.entries()) {
        const pkg = await prisma.medicinePackage.create({
          data: {
            medicineId: m.id,
            quantity: pack.qty,
            unit: pack.unit,
            barcode: pack.barcode,
            isDefault: pi === 0,
            description: `${pack.qty} ${pack.unit}`,
          },
        });
        const packFactor = pack.qty / d.packs[0]!.qty;
        const markets = new Set([d.country, ...d.registrations.map((r) => r.country)]);
        for (const market of markets) {
          const currency = countryCurrency.get(market)!;
          const rate = currency === 'EUR' ? 1 : DEMO_RATES[currency]!;
          const base = d.eur * MARKET_FACTOR[market]! * (0.85 + 0.15 * packFactor + 0.0) * rate;
          const pharmaciesHere = pharmacyIds.filter((p) => p.country === market);
          const targets: (string | null)[] = [null, ...pharmaciesHere.map((p) => p.id)];
          for (const pharmacyId of targets) {
            const jitter = pharmacyId ? 0.92 + rand() * 0.16 : 1.08;
            const amount = round(base * jitter, currency);
            const stale = rand() < 0.15;
            const observedAt = new Date(now.getTime() - (stale ? 75 : Math.floor(rand() * 10)) * 86_400_000);
            const offer = await prisma.pharmacyOffer.create({
              data: {
                packageId: pkg.id,
                pharmacyId,
                countryCode: market,
                sourceId: 'demo',
                sourceReference: `${d.key}:${pi}:${market}:${pharmacyId ?? 'list'}`,
                isDemo: true,
                price: {
                  create: {
                    amount,
                    currency,
                    priceType: pharmacyId ? 'RETAIL' : 'MAX_RETAIL',
                    observedAt,
                    verification: 'DEMO',
                  },
                },
              },
            });
            // six monthly snapshots of history
            const snapshots = Array.from({ length: 6 }, (_, k) => ({
              offerId: offer.id,
              amount: round(amount * (1 - (5 - k) * 0.012 + (rand() - 0.5) * 0.02), currency),
              currency,
              capturedAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - k), 1)),
            }));
            await prisma.priceSnapshot.createMany({ data: snapshots, skipDuplicates: true });
            if (pharmacyId) {
              const r = rand();
              await prisma.availabilityRecord.create({
                data: {
                  offerId: offer.id,
                  status: r < 0.7 ? 'IN_STOCK' : r < 0.85 ? 'LIMITED' : r < 0.93 ? 'OUT_OF_STOCK' : 'UNKNOWN',
                  observedAt,
                  sourceId: 'demo',
                },
              });
            }
          }
        }
      }
    }
    await refreshSearchText(prisma, m.id);
  }
  console.log(`Demo data: ${MEDICINES.length} medicines, ${PHARMACIES.length} pharmacies.`);
}

function round(amount: number, currency: string): number {
  return currency === 'HUF' ? Math.round(amount / 5) * 5 : Math.round(amount * 100) / 100;
}

async function main() {
  await seedReference();
  await seedAdmin();
  const demo = process.env.SEED_DEMO === 'true';
  if (demo && process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demonstration data in production.');
  }
  if (demo) await seedDemo();
  else console.log('SEED_DEMO is not "true" — demonstration data not seeded.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
