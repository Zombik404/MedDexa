import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { normalizeText } from '@meddexa/shared';
import type { z } from 'zod';
import { AuditService } from '../common/audit.service';
import { ClientIp, CurrentUser, Roles, type RequestUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { refreshSearchText } from '../medicines/search-text';
import { PrismaService } from '../prisma/prisma.service';
import {
  adminListSchema,
  formSchema,
  ingredientSchema,
  ingredientsReplaceSchema,
  manufacturerSchema,
  medicineUpsertSchema,
  mergeSchema,
  packageSchema,
  registrationSchema,
  synonymSchema,
  type AdminListQuery,
} from './admin.schemas';

const fullMedicine = {
  manufacturer: true,
  form: true,
  atc: true,
  source: true,
  ingredients: { include: { ingredient: { include: { moiety: true } } }, orderBy: { position: 'asc' } },
  packages: { orderBy: { quantity: 'asc' } },
  registrations: { orderBy: { countryCode: 'asc' } },
  synonyms: true,
  duplicateOf: { select: { id: true, name: true } },
} satisfies Prisma.MedicineInclude;

@ApiTags('admin')
@ApiBearerAuth()
@Roles('EDITOR', 'ADMIN')
@Controller('admin')
export class AdminCatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ───────── Medicines ─────────

  @Get('medicines')
  async listMedicines(@Query(new ZodPipe(adminListSchema)) q: AdminListQuery) {
    const where: Prisma.MedicineWhereInput = {
      ...(q.q ? { OR: [{ normalizedName: { contains: normalizeText(q.q) } }, { searchText: { contains: normalizeText(q.q) } }] } : {}),
      ...(q.status ? { status: q.status as Prisma.EnumRecordStatusFilter['equals'] } : {}),
      ...(q.country ? { countryCode: q.country } : {}),
      ...(q.demo ? { isDemo: q.demo === 'true' } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.medicine.findMany({
        where,
        include: { manufacturer: true, form: true, _count: { select: { ingredients: true, packages: true, registrations: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.medicine.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Get('medicines/duplicates')
  async duplicates() {
    // Candidate pairs: identical composition signature, form and route, plus either a
    // similar name or the same brand. Editors confirm; nothing is merged automatically.
    return this.prisma.$queryRaw<
      { aId: string; aName: string; bId: string; bName: string; nameSimilarity: number; sameBrand: boolean }[]
    >(Prisma.sql`
      WITH sig AS (
        SELECT m.id, m.name, m."normalizedName", lower(coalesce(m.brand, '')) AS brand, m."formCode", m.route,
               string_agg(iq."ingredientId" || ':' || coalesce(iq.amount::text, '?') || ':' || coalesce(iq.unit, '?'), '|' ORDER BY iq."ingredientId") AS signature
        FROM medicines m JOIN ingredient_quantities iq ON iq."medicineId" = m.id
        WHERE m."duplicateOfId" IS NULL AND m.status <> 'ARCHIVED'
        GROUP BY m.id
      )
      SELECT a.id AS "aId", a.name AS "aName", b.id AS "bId", b.name AS "bName",
             similarity(a."normalizedName", b."normalizedName")::float AS "nameSimilarity",
             (a.brand <> '' AND a.brand = b.brand) AS "sameBrand"
      FROM sig a JOIN sig b ON a.id < b.id AND a.signature = b.signature
        AND a."formCode" IS NOT DISTINCT FROM b."formCode" AND a.route IS NOT DISTINCT FROM b.route
      WHERE similarity(a."normalizedName", b."normalizedName") > 0.35 OR (a.brand <> '' AND a.brand = b.brand)
      ORDER BY "nameSimilarity" DESC
      LIMIT 200`);
  }

  @Get('medicines/:id')
  async getMedicine(@Param('id') id: string) {
    const m = await this.prisma.medicine.findUnique({ where: { id }, include: fullMedicine });
    if (!m) throw new NotFoundException('Medicine not found');
    return m;
  }

  @Post('medicines')
  async createMedicine(@Body(new ZodPipe(medicineUpsertSchema)) body: z.infer<typeof medicineUpsertSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const m = await this.prisma.medicine.create({
      data: { ...body, normalizedName: normalizeText(body.name), verification: body.verification ?? 'UNVERIFIED' },
    });
    await refreshSearchText(this.prisma, m.id);
    await this.audit.log({ actorId: user.id, action: 'medicine.create', entityType: 'Medicine', entityId: m.id, after: body, ip });
    return m;
  }

  @Patch('medicines/:id')
  async updateMedicine(@Param('id') id: string, @Body(new ZodPipe(medicineUpsertSchema.partial())) body: Partial<z.infer<typeof medicineUpsertSchema>>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const before = await this.prisma.medicine.findUniqueOrThrow({ where: { id } });
    const m = await this.prisma.medicine.update({
      where: { id },
      data: { ...body, ...(body.name ? { normalizedName: normalizeText(body.name) } : {}) },
    });
    await refreshSearchText(this.prisma, id);
    await this.audit.log({ actorId: user.id, action: 'medicine.update', entityType: 'Medicine', entityId: id, before, after: body, ip });
    return m;
  }

  @Delete('medicines/:id')
  @HttpCode(204)
  async archiveMedicine(@Param('id') id: string, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    await this.prisma.medicine.update({ where: { id }, data: { status: 'ARCHIVED' } });
    await this.audit.log({ actorId: user.id, action: 'medicine.archive', entityType: 'Medicine', entityId: id, ip });
  }

  @Put('medicines/:id/ingredients')
  async replaceIngredients(@Param('id') id: string, @Body(new ZodPipe(ingredientsReplaceSchema)) body: z.infer<typeof ingredientsReplaceSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const before = await this.prisma.ingredientQuantity.findMany({ where: { medicineId: id } });
    await this.prisma.$transaction([
      this.prisma.ingredientQuantity.deleteMany({ where: { medicineId: id } }),
      this.prisma.ingredientQuantity.createMany({
        data: body.ingredients.map((i, position) => ({ ...i, medicineId: id, position, perAmount: i.perAmount ?? null, perUnit: i.perUnit ?? null })),
      }),
    ]);
    await refreshSearchText(this.prisma, id);
    await this.audit.log({ actorId: user.id, action: 'medicine.ingredients', entityType: 'Medicine', entityId: id, before, after: body.ingredients, ip });
    return this.getMedicine(id);
  }

  @Post('medicines/:id/packages')
  async addPackage(@Param('id') id: string, @Body(new ZodPipe(packageSchema)) body: z.infer<typeof packageSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    if (body.isDefault) await this.prisma.medicinePackage.updateMany({ where: { medicineId: id }, data: { isDefault: false } });
    const p = await this.prisma.medicinePackage.create({ data: { ...body, medicineId: id, description: body.description ?? `${body.quantity} ${body.unit}` } });
    await refreshSearchText(this.prisma, id);
    await this.audit.log({ actorId: user.id, action: 'package.create', entityType: 'MedicinePackage', entityId: p.id, after: body, ip });
    return p;
  }

  @Delete('packages/:pid')
  @HttpCode(204)
  async deletePackage(@Param('pid') pid: string, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const p = await this.prisma.medicinePackage.delete({ where: { id: pid } });
    await refreshSearchText(this.prisma, p.medicineId);
    await this.audit.log({ actorId: user.id, action: 'package.delete', entityType: 'MedicinePackage', entityId: pid, before: p, ip });
  }

  @Post('medicines/:id/registrations')
  async addRegistration(@Param('id') id: string, @Body(new ZodPipe(registrationSchema)) body: z.infer<typeof registrationSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const r = await this.prisma.productRegistration.create({ data: { ...body, medicineId: id, verification: 'UNVERIFIED' } });
    await refreshSearchText(this.prisma, id);
    await this.audit.log({ actorId: user.id, action: 'registration.create', entityType: 'ProductRegistration', entityId: r.id, after: body, ip });
    return r;
  }

  @Delete('registrations/:rid')
  @HttpCode(204)
  async deleteRegistration(@Param('rid') rid: string, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const r = await this.prisma.productRegistration.delete({ where: { id: rid } });
    await refreshSearchText(this.prisma, r.medicineId);
    await this.audit.log({ actorId: user.id, action: 'registration.delete', entityType: 'ProductRegistration', entityId: rid, before: r, ip });
  }

  @Post('medicines/:id/synonyms')
  async addSynonym(@Param('id') id: string, @Body(new ZodPipe(synonymSchema)) body: z.infer<typeof synonymSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const s = await this.prisma.productSynonym.create({ data: { ...body, medicineId: id, normalizedName: normalizeText(body.name) } });
    await refreshSearchText(this.prisma, id);
    await this.audit.log({ actorId: user.id, action: 'synonym.create', entityType: 'ProductSynonym', entityId: s.id, after: body, ip });
    return s;
  }

  @Post('medicines/:id/merge')
  @HttpCode(200)
  async merge(@Param('id') id: string, @Body(new ZodPipe(mergeSchema)) body: { intoId: string }, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    if (id === body.intoId) throw new BadRequestException('Cannot merge a medicine into itself');
    const target = await this.prisma.medicine.findUniqueOrThrow({ where: { id: body.intoId } });
    if (target.duplicateOfId) throw new BadRequestException('Target is itself marked as a duplicate');
    await this.prisma.$transaction([
      this.prisma.medicine.update({ where: { id }, data: { duplicateOfId: body.intoId, status: 'ARCHIVED' } }),
      this.prisma.productRegistration.updateMany({ where: { medicineId: id }, data: { medicineId: body.intoId } }),
    ]);
    await refreshSearchText(this.prisma, body.intoId);
    await this.audit.log({ actorId: user.id, action: 'medicine.merge', entityType: 'Medicine', entityId: id, after: body, ip });
    return { merged: true };
  }

  // ───────── Ingredients, manufacturers, forms ─────────

  @Get('ingredients')
  ingredients(@Query(new ZodPipe(adminListSchema)) q: AdminListQuery) {
    return this.prisma.activeIngredient.findMany({
      where: q.q ? { OR: [{ normalizedName: { contains: normalizeText(q.q) } }, { synonyms: { some: { normalizedName: { contains: normalizeText(q.q) } } } }] } : {},
      include: { moiety: true, synonyms: true, _count: { select: { quantities: true } } },
      orderBy: { name: 'asc' },
      take: q.pageSize,
      skip: (q.page - 1) * q.pageSize,
    });
  }

  @Post('ingredients')
  async createIngredient(@Body(new ZodPipe(ingredientSchema)) body: z.infer<typeof ingredientSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const i = await this.prisma.activeIngredient.create({
      data: {
        name: body.name,
        normalizedName: normalizeText(body.name),
        moietyId: body.moietyId ?? null,
        casNumber: body.casNumber ?? null,
        synonyms: { create: (body.synonyms ?? []).map((s) => ({ name: s.name, normalizedName: normalizeText(s.name), language: s.language ?? null })) },
      },
    });
    await this.audit.log({ actorId: user.id, action: 'ingredient.create', entityType: 'ActiveIngredient', entityId: i.id, after: body, ip });
    return i;
  }

  @Patch('ingredients/:id')
  async updateIngredient(@Param('id') id: string, @Body(new ZodPipe(ingredientSchema.partial())) body: Partial<z.infer<typeof ingredientSchema>>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    if (body.moietyId === id) throw new BadRequestException('An ingredient cannot be its own moiety');
    const i = await this.prisma.activeIngredient.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name, normalizedName: normalizeText(body.name) } : {}),
        ...(body.moietyId !== undefined ? { moietyId: body.moietyId } : {}),
        ...(body.casNumber !== undefined ? { casNumber: body.casNumber } : {}),
      },
    });
    if (body.synonyms) {
      await this.prisma.ingredientSynonym.deleteMany({ where: { ingredientId: id } });
      await this.prisma.ingredientSynonym.createMany({
        data: body.synonyms.map((s) => ({ ingredientId: id, name: s.name, normalizedName: normalizeText(s.name), language: s.language ?? null })),
        skipDuplicates: true,
      });
    }
    // Ingredient names feed every affected medicine's search document.
    const affected = await this.prisma.ingredientQuantity.findMany({ where: { ingredientId: id }, select: { medicineId: true } });
    for (const a of affected) await refreshSearchText(this.prisma, a.medicineId);
    await this.audit.log({ actorId: user.id, action: 'ingredient.update', entityType: 'ActiveIngredient', entityId: id, after: body, ip });
    return i;
  }

  @Get('manufacturers')
  manufacturers(@Query(new ZodPipe(adminListSchema)) q: AdminListQuery) {
    return this.prisma.manufacturer.findMany({
      where: q.q ? { normalizedName: { contains: normalizeText(q.q) } } : {},
      include: { _count: { select: { medicines: true } } },
      orderBy: { name: 'asc' },
      take: q.pageSize,
      skip: (q.page - 1) * q.pageSize,
    });
  }

  @Post('manufacturers')
  async createManufacturer(@Body(new ZodPipe(manufacturerSchema)) body: z.infer<typeof manufacturerSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const m = await this.prisma.manufacturer.create({ data: { ...body, normalizedName: normalizeText(body.name) } });
    await this.audit.log({ actorId: user.id, action: 'manufacturer.create', entityType: 'Manufacturer', entityId: m.id, after: body, ip });
    return m;
  }

  @Patch('manufacturers/:id')
  async updateManufacturer(@Param('id') id: string, @Body(new ZodPipe(manufacturerSchema.partial())) body: Partial<z.infer<typeof manufacturerSchema>>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const m = await this.prisma.manufacturer.update({ where: { id }, data: { ...body, ...(body.name ? { normalizedName: normalizeText(body.name) } : {}) } });
    await this.audit.log({ actorId: user.id, action: 'manufacturer.update', entityType: 'Manufacturer', entityId: id, after: body, ip });
    return m;
  }

  @Get('forms')
  forms() {
    return this.prisma.pharmaceuticalForm.findMany({ include: { _count: { select: { medicines: true } } }, orderBy: { name: 'asc' } });
  }

  @Put('forms/:code')
  async upsertForm(@Param('code') code: string, @Body(new ZodPipe(formSchema)) body: z.infer<typeof formSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    if (body.code !== code) throw new BadRequestException('Code mismatch');
    const f = await this.prisma.pharmaceuticalForm.upsert({ where: { code }, update: body, create: body });
    await this.audit.log({ actorId: user.id, action: 'form.upsert', entityType: 'PharmaceuticalForm', entityId: code, after: body, ip });
    return f;
  }
}
