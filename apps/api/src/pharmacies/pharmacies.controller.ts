import { Controller, Get, Param, Query, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { pharmacySearchSchema, type PharmacySearchQuery } from '@meddexa/shared';
import { z } from 'zod';
import { CurrentUser, type RequestUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { AdapterConfigurationError } from '../integrations/adapter';
import { PharmaciesService } from './pharmacies.service';

const coords = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.5).max(50).default(5),
});
const optionalCoords = z.object({ lat: z.coerce.number().optional(), lng: z.coerce.number().optional() });

@ApiTags('pharmacies')
@Controller('pharmacies')
export class PharmaciesController {
  constructor(private readonly pharmacies: PharmaciesService) {}

  @Get()
  @ApiOperation({ summary: 'Search pharmacies by location, city, address, postcode or country' })
  search(@Query(new ZodPipe(pharmacySearchSchema)) q: PharmacySearchQuery) {
    return this.pharmacies.search(q);
  }

  @Get('external/google')
  @ApiOperation({ summary: 'Live Google Places results (not stored, requires GOOGLE_MAPS_API_KEY)' })
  async google(@Query(new ZodPipe(coords)) q: z.infer<typeof coords>) {
    try {
      return await this.pharmacies.googleNearby(q.lat, q.lng, q.radiusKm);
    } catch (e) {
      if (e instanceof AdapterConfigurationError) {
        throw new ServiceUnavailableException({ message: e.message, code: 'PROVIDER_NOT_CONFIGURED' });
      }
      throw e;
    }
  }

  @Get(':id')
  detail(@Param('id') id: string, @Query(new ZodPipe(optionalCoords)) c: { lat?: number; lng?: number }, @CurrentUser() user: RequestUser | null) {
    return this.pharmacies.detail(id, user, c.lat, c.lng);
  }
}
