import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { medicineSearchSchema, suggestSchema, type MedicineSearchQuery } from '@meddexa/shared';
import { resolveCurrency } from '../common/currency';
import { CurrentUser, type RequestUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PricesService } from '../prices/prices.service';
import { MedicinesService } from './medicines.service';
import { SearchService } from './search.service';
import { AnalyticsService } from '../analytics/analytics.service';

@ApiTags('medicines')
@Controller('medicines')
export class MedicinesController {
  constructor(
    private readonly medicines: MedicinesService,
    private readonly searchService: SearchService,
    private readonly prices: PricesService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get('search')
  @ApiOperation({ summary: 'Search medicines (guest access)' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'ingredients', required: false, description: 'Comma-separated active ingredients (all must match)' })
  @ApiQuery({ name: 'manufacturer', required: false })
  @ApiQuery({ name: 'atc', required: false })
  @ApiQuery({ name: 'form', required: false })
  @ApiQuery({ name: 'route', required: false })
  @ApiQuery({ name: 'prescription', required: false, enum: ['RX', 'OTC', 'PHARMACY_ONLY'] })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'strength', required: false, example: '400 mg' })
  @ApiQuery({ name: 'packageSize', required: false })
  @ApiQuery({ name: 'barcode', required: false })
  @ApiQuery({ name: 'registrationNumber', required: false })
  @ApiQuery({ name: 'hasPrice', required: false })
  @ApiQuery({ name: 'sort', required: false, enum: ['relevance', 'name', 'price_asc', 'price_desc', 'rating'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'currency', required: false })
  search(@Query(new ZodPipe(medicineSearchSchema)) query: MedicineSearchQuery, @CurrentUser() user: RequestUser | null) {
    return this.medicines.searchMedicines(query, resolveCurrency(query.currency), user);
  }

  @Get('suggest')
  @ApiQuery({ name: 'q' })
  async suggest(@Query(new ZodPipe(suggestSchema)) query: { q: string }) {
    const items = await this.searchService.suggest(query.q);
    this.analytics.record('SUGGEST', { query: query.q, resultCount: items.length });
    return items;
  }

  @Get('popular')
  popular(@Query('currency') currency?: string) {
    return this.medicines.popular(resolveCurrency(currency));
  }

  @Get('popular-searches')
  popularSearches() {
    return this.medicines.popularSearches();
  }

  @Get('categories')
  categories() {
    return this.medicines.categories();
  }

  @Get(':id')
  detail(@Param('id') id: string, @Query('currency') currency: string | undefined, @CurrentUser() user: RequestUser | null) {
    return this.medicines.detail(id, resolveCurrency(currency), user);
  }

  @Get(':id/similar')
  similar(@Param('id') id: string, @Query('currency') currency?: string) {
    return this.medicines.similar(id, resolveCurrency(currency));
  }

  @Get(':id/prices')
  @ApiQuery({ name: 'currency', required: false })
  @ApiQuery({ name: 'country', required: false })
  pricesFor(@Param('id') id: string, @Query('currency') currency?: string, @Query('country') country?: string) {
    return this.prices.forMedicine(id, resolveCurrency(currency), country?.toUpperCase() || undefined);
  }
}
