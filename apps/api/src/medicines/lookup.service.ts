import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { parseScannedCode, type PhotoSearchResponse, type ScanLookupResponse } from '@meddexa/shared';
import type { Env } from '../config/env';
import { fetchCimaByCn } from '../integrations/adapters/cima.adapter';
import { upsertImportedMedicine } from '../integrations/importer';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { extractBoxText, rankByBoxText } from './box-text';
import { MedicinesService } from './medicines.service';
import { OcrService } from './ocr.service';
import { SearchService } from './search.service';

/** Barcode and photo lookups. Both only ever return products that exist in an official source. */
@Injectable()
export class LookupService {
  private readonly logger = new Logger(LookupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly medicines: MedicinesService,
    private readonly search: SearchService,
    private readonly ocr: OcrService,
    private readonly analytics: AnalyticsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private demoFilter(): Prisma.MedicineWhereInput {
    return this.config.get('ALLOW_DEMO_DATA', { infer: true }) ? {} : { isDemo: false };
  }

  private async idsForScan(scan: ReturnType<typeof parseScannedCode>): Promise<string[]> {
    const rawCodes = [scan.raw.replace(/\D/g, ''), ...(scan.gtin ? [scan.gtin, scan.gtin.replace(/^0/, '')] : [])].filter(Boolean);
    if (!scan.candidates.length && !rawCodes.length) return [];
    const rows = await this.prisma.medicine.findMany({
      where: {
        status: 'ACTIVE',
        duplicateOfId: null,
        ...this.demoFilter(),
        OR: [
          ...(scan.candidates.length ? [{ codes: { some: { OR: scan.candidates.map((c) => ({ system: c.system, code: c.code })) } } }] : []),
          ...(rawCodes.length ? [{ packages: { some: { barcode: { in: rawCodes } } } }] : []),
        ],
      },
      select: { id: true },
      orderBy: { name: 'asc' },
      take: 10,
    });
    return rows.map((r) => r.id);
  }

  /** Spanish boxes not yet in the catalogue are fetched from AEMPS CIMA by national code. */
  private async fetchSpanish(cn: string): Promise<string | null> {
    if (!this.config.get('LIVE_REGISTRY_LOOKUP', { infer: true })) return null;
    const source = await this.prisma.dataSource.findFirst({ where: { adapter: 'cima', enabled: true } });
    if (!source) return null;
    try {
      const imported = await fetchCimaByCn(fetch, source.url ?? 'https://cima.aemps.es/cima/rest/', cn);
      if (!imported) return null;
      await upsertImportedMedicine(this.prisma, source.id, imported);
      const m = await this.prisma.medicine.findUnique({
        where: { sourceId_sourceReference: { sourceId: source.id, sourceReference: imported.sourceReference } },
        select: { id: true },
      });
      return m?.id ?? null;
    } catch (e) {
      this.logger.warn(`CIMA live lookup for CN ${cn} failed: ${(e as Error).message}`);
      return null;
    }
  }

  async scan(code: string, currency: string): Promise<ScanLookupResponse> {
    const scan = parseScannedCode(code);
    let ids = await this.idsForScan(scan);
    let fetchedFromOfficialSource = false;
    if (!ids.length) {
      const cn = scan.candidates.find((c) => c.system === 'CN_ES');
      const id = cn ? await this.fetchSpanish(cn.code) : null;
      if (id) {
        ids = [id];
        fetchedFromOfficialSource = true;
      }
    }
    // The code itself is not recorded: only that a scan happened and whether it matched.
    this.analytics.record('SEARCH', { query: 'barcode-scan', resultCount: ids.length });
    return { scan, matches: await this.medicines.summaries(ids, currency), fetchedFromOfficialSource };
  }

  async fromText(lines: string[], currency: string): Promise<PhotoSearchResponse> {
    const box = extractBoxText(lines);
    // A barcode printed as digits under the bars is the most reliable signal on the photo.
    for (const digits of lines.join(' ').match(/\b\d{8,14}\b/g) ?? []) {
      const scan = parseScannedCode(digits);
      if (!scan.gtin) continue;
      const ids = await this.idsForScan(scan);
      if (ids.length) return { recognizedText: lines, terms: box.words, matches: await this.medicines.summaries(ids, currency) };
    }
    const candidateIds = await this.search.candidatesForWords(box.words);
    const candidates = await this.medicines.summaries(candidateIds, currency);
    const ranked = rankByBoxText(box, candidates).slice(0, 5);
    this.analytics.record('SEARCH', { query: 'photo-search', resultCount: ranked.length });
    return { recognizedText: lines, terms: box.words, matches: ranked.map((r) => r.medicine) };
  }

  async fromPhoto(image: Buffer, currency: string): Promise<PhotoSearchResponse> {
    const lines = await this.ocr.readLines(image);
    if (!lines.length) return { recognizedText: [], terms: [], matches: [] };
    return this.fromText(lines, currency);
  }
}
