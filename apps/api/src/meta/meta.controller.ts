import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES, type MetaView } from '@meddexa/shared';
import { CacheService } from '../common/cache.service';
import { FxService } from '../prices/fx.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('meta')
@Controller()
export class MetaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly fx: FxService,
  ) {}

  @Get('meta')
  meta(): Promise<MetaView> {
    return this.cache.wrap('meta:v1', 300, async () => {
      const [countries, forms, services, atc, routes] = await Promise.all([
        this.prisma.country.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.pharmaceuticalForm.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.pharmacyService.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.atcClass.findMany({ where: { level: 1 }, orderBy: { code: 'asc' } }),
        this.prisma.medicine.findMany({ where: { route: { not: null } }, distinct: ['route'], select: { route: true } }),
      ]);
      return {
        countries: countries.map((c) => ({ code: c.code, name: c.name, currency: c.currencyCode, supported: c.supported })),
        languages: SUPPORTED_LANGUAGES.map((l) => ({ ...l })),
        currencies: [...SUPPORTED_CURRENCIES],
        forms: forms.map((f) => ({ code: f.code, name: f.name, group: f.group })),
        routes: routes.map((r) => r.route!).sort(),
        services: services.map((s) => ({ code: s.code, name: s.name })),
        atcGroups: atc.map((a) => ({ code: a.code, name: a.name })),
      };
    });
  }

  @Get('fx/rates')
  async rates() {
    const t = await this.fx.table();
    return t ?? { base: 'EUR', date: null, source: null, rates: {}, isFallback: false };
  }
}
