import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  filterOptionsSchema,
  ingredientNamesSchema,
  ingredientSearchSchema,
  type FilterOptionField,
  medicineSearchSchema,
  photoTextSchema,
  scanLookupSchema,
  suggestSchema,
  type MedicineSearchQuery,
  type ScanLookupQuery,
} from '@meddexa/shared';
import { limit } from '../common/throttle';
import { LookupService } from './lookup.service';
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
    private readonly lookup: LookupService,
  ) {}

  @Get('search')
  @ApiOperation({ summary: 'Search medicines (guest access)' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'ingredients', required: false, description: 'Comma-separated active ingredients (all must match)' })
  @ApiQuery({ name: 'manufacturer', required: false })
  @ApiQuery({ name: 'atc', required: false })
  @ApiQuery({ name: 'category', required: false, description: 'Everyday category slug, e.g. pain, allergy' })
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

  @Get('filter-options')
  @ApiOperation({ summary: 'Type-ahead values for a search filter (values starting with the typed text)' })
  @ApiQuery({ name: 'field', enum: ['ingredient', 'manufacturer', 'atc', 'strength', 'packageSize', 'registration'] })
  @ApiQuery({ name: 'q', required: false })
  filterOptions(@Query(new ZodPipe(filterOptionsSchema)) query: { field: FilterOptionField; q: string }) {
    return this.searchService.filterOptions(query.field, query.q);
  }

  @Get('scan')
  @ApiOperation({ summary: 'Find a medicine by the barcode / DataMatrix / national code on its box' })
  @ApiQuery({ name: 'code', description: 'Raw scanner output or typed code (EAN-13, GS1 DataMatrix, CN, CIP, PZN …)' })
  @ApiQuery({ name: 'currency', required: false })
  @Throttle(limit(60))
  scan(@Query(new ZodPipe(scanLookupSchema)) query: ScanLookupQuery) {
    return this.lookup.scan(query.code, resolveCurrency(query.currency));
  }

  @Post('photo')
  @HttpCode(200)
  @ApiOperation({ summary: 'Find a medicine from a photo of its box (text recognition; the image is not stored)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } } })
  @ApiQuery({ name: 'currency', required: false })
  @Throttle(limit(10))
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  photo(@UploadedFile() file: { buffer?: Buffer; mimetype: string } | undefined, @Query('currency') currency?: string) {
    if (!file?.buffer?.length) throw new BadRequestException({ message: 'An image file is required', code: 'IMAGE_REQUIRED' });
    if (!/^image\/(jpeg|png|webp|bmp)$/.test(file.mimetype)) {
      throw new BadRequestException({ message: 'Use a JPEG, PNG or WebP image', code: 'IMAGE_TYPE' });
    }
    return this.lookup.fromPhoto(file.buffer, resolveCurrency(currency));
  }

  @Post('photo/text')
  @HttpCode(200)
  @ApiOperation({ summary: 'Find a medicine from text already recognised on the device' })
  @Throttle(limit(30))
  photoText(@Body(new ZodPipe(photoTextSchema)) body: { lines: string[]; currency?: string }) {
    return this.lookup.fromText(body.lines, resolveCurrency(body.currency));
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

@ApiTags('medicines')
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly searchService: SearchService) {}

  @Get('names')
  @ApiOperation({ summary: 'Ingredient names in a language (for showing the catalogue in the user language)' })
  @ApiQuery({ name: 'lang' })
  names(@Query(new ZodPipe(ingredientNamesSchema)) query: { lang: string }) {
    return this.searchService.ingredientNames(query.lang);
  }

  @Get('search')
  @ApiOperation({ summary: 'Active ingredients by name or translated synonym, with product counts' })
  @ApiQuery({ name: 'q' })
  search(@Query(new ZodPipe(ingredientSearchSchema)) query: { q: string }) {
    return this.searchService.ingredients(query.q);
  }
}
