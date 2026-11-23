import { XMLParser } from 'fast-xml-parser';
import type { DataAdapter, SyncContext, SyncResult } from '../adapter';

export interface ParsedRates {
  date: string;
  rates: Record<string, number>;
}

/** Parses the ECB eurofxref-daily.xml document. */
export function parseEcbXml(xml: string): ParsedRates {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' , removeNSPrefix: true });
  const doc = parser.parse(xml);
  const dayCube = doc?.Envelope?.Cube?.Cube;
  if (!dayCube?.time) throw new Error('Unexpected ECB XML structure');
  const entries = Array.isArray(dayCube.Cube) ? dayCube.Cube : [dayCube.Cube];
  const rates: Record<string, number> = {};
  for (const e of entries) {
    const rate = Number(e.rate);
    if (e.currency && rate > 0) rates[String(e.currency)] = rate;
  }
  return { date: String(dayCube.time), rates };
}

export const ecbAdapter: DataAdapter = {
  key: 'ecb',
  async sync(ctx: SyncContext): Promise<SyncResult> {
    const url = ctx.source.url ?? 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
    const res = await ctx.fetch(url, { headers: { Accept: 'application/xml' } });
    if (!res.ok) throw new Error(`ECB responded ${res.status}`);
    const { date, rates } = parseEcbXml(await res.text());
    const rateDate = new Date(`${date}T00:00:00Z`);
    let created = 0;
    let updated = 0;
    for (const [currency, rate] of Object.entries(rates)) {
      const existing = await ctx.prisma.exchangeRate.findUnique({
        where: { currency_rateDate_sourceId: { currency, rateDate, sourceId: ctx.source.id } },
      });
      await ctx.prisma.exchangeRate.upsert({
        where: { currency_rateDate_sourceId: { currency, rateDate, sourceId: ctx.source.id } },
        update: { rate },
        create: { currency, rate, rateDate, sourceId: ctx.source.id },
      });
      existing ? updated++ : created++;
    }
    ctx.log(`ECB rates for ${date}: ${Object.keys(rates).length} currencies`);
    return { read: Object.keys(rates).length, created, updated, failed: 0, details: { date } };
  },
};
