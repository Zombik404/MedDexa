import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { limit } from '../common/throttle';
import { z } from 'zod';
import {
  medicineReviewSchema,
  pharmacyReviewSchema,
  reportReviewSchema,
  type MedicineReviewInput,
  type PharmacyReviewInput,
} from '@meddexa/shared';
import { CurrentUser, RequireAuth, type RequestUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ReviewsService } from './reviews.service';

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  language: z.string().max(10).optional(),
  sort: z.enum(['recent', 'helpful']).default('recent'),
});
type ListQuery = z.infer<typeof listSchema>;

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('medicines/:id/reviews')
  medicineReviews(@Param('id') id: string, @Query(new ZodPipe(listSchema)) q: ListQuery, @CurrentUser() user: RequestUser | null) {
    return this.reviews.list({ medicineId: id }, q, user);
  }

  @Post('medicines/:id/reviews')
  @RequireAuth()
  @Throttle(limit(5))
  createMedicineReview(@Param('id') id: string, @Body(new ZodPipe(medicineReviewSchema)) body: MedicineReviewInput, @CurrentUser() user: RequestUser) {
    return this.reviews.createForMedicine(user, id, body);
  }

  @Get('pharmacies/:id/reviews')
  pharmacyReviews(@Param('id') id: string, @Query(new ZodPipe(listSchema)) q: ListQuery, @CurrentUser() user: RequestUser | null) {
    return this.reviews.list({ pharmacyId: id }, q, user);
  }

  @Post('pharmacies/:id/reviews')
  @RequireAuth()
  @Throttle(limit(5))
  createPharmacyReview(@Param('id') id: string, @Body(new ZodPipe(pharmacyReviewSchema)) body: PharmacyReviewInput, @CurrentUser() user: RequestUser) {
    return this.reviews.createForPharmacy(user, id, body);
  }

  @Post('reviews/:id/helpful')
  @HttpCode(200)
  @RequireAuth()
  helpful(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.reviews.toggleHelpful(user, id);
  }

  @Post('reviews/:id/report')
  @HttpCode(200)
  @RequireAuth()
  report(@Param('id') id: string, @Body(new ZodPipe(reportReviewSchema)) body: z.infer<typeof reportReviewSchema>, @CurrentUser() user: RequestUser) {
    return this.reviews.report(user, id, body.reason, body.details);
  }

  @Delete('reviews/:id')
  @HttpCode(204)
  @RequireAuth()
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.reviews.deleteOwn(user, id);
  }
}
