import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Review } from '@prisma/client';
import type { MedicineReviewInput, PharmacyReviewInput, ReviewPage, ReviewStats, ReviewView } from '@meddexa/shared';
import type { RequestUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { moderateText } from './moderation';

const MAX_REVIEWS_PER_DAY = 5;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private authorName(u: { displayName: string | null }): string {
    if (!u.displayName) return 'MedDexa user';
    const [first, last] = u.displayName.trim().split(/\s+/);
    return last ? `${first} ${last[0]}.` : first!;
  }

  private toView(r: Review & { author: { displayName: string | null } }, votedIds: Set<string>): ReviewView {
    const view: ReviewView = {
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      language: r.language,
      countryCode: r.countryCode,
      authorName: this.authorName(r.author),
      createdAt: r.createdAt.toISOString(),
      helpfulCount: r.helpfulCount,
      votedHelpful: votedIds.has(r.id),
    };
    if (r.target === 'PHARMACY') {
      view.subRatings = {
        staff: r.staffRating,
        service: r.serviceRating,
        waiting: r.waitingRating,
        cleanliness: r.cleanlinessRating,
        accessibility: r.accessibilityRating,
      };
    }
    return view;
  }

  async stats(where: Prisma.ReviewWhereInput): Promise<ReviewStats> {
    const groups = await this.prisma.review.groupBy({ by: ['rating'], where: { ...where, status: 'PUBLISHED' }, _count: { _all: true } });
    const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } as ReviewStats['distribution'];
    let sum = 0;
    let count = 0;
    for (const g of groups) {
      distribution[String(g.rating) as keyof typeof distribution] = g._count._all;
      sum += g.rating * g._count._all;
      count += g._count._all;
    }
    return { average: count ? Math.round((sum / count) * 10) / 10 : null, count, distribution };
  }

  async list(
    target: { medicineId?: string; pharmacyId?: string },
    opts: { page: number; pageSize: number; language?: string; sort?: 'recent' | 'helpful' },
    user: RequestUser | null,
  ): Promise<ReviewPage> {
    const where: Prisma.ReviewWhereInput = { ...target, status: 'PUBLISHED', ...(opts.language ? { language: opts.language } : {}) };
    const [rows, total, stats] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: { author: { select: { displayName: true } } },
        orderBy: opts.sort === 'helpful' ? [{ helpfulCount: 'desc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      this.prisma.review.count({ where }),
      this.stats(target),
    ]);
    const voted = user
      ? new Set((await this.prisma.reviewVote.findMany({ where: { userId: user.id, reviewId: { in: rows.map((r) => r.id) } } })).map((v) => v.reviewId))
      : new Set<string>();
    return {
      items: rows.map((r) => this.toView(r, voted)),
      page: opts.page,
      pageSize: opts.pageSize,
      total,
      hasMore: opts.page * opts.pageSize < total,
      stats,
    };
  }

  private async guardRate(userId: string) {
    const recent = await this.prisma.review.count({ where: { authorId: userId, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    if (recent >= MAX_REVIEWS_PER_DAY) {
      throw new HttpException({ message: 'Daily review limit reached', code: 'REVIEW_RATE_LIMIT' }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async createForMedicine(user: RequestUser, medicineId: string, input: MedicineReviewInput) {
    if (!(await this.prisma.medicine.findUnique({ where: { id: medicineId }, select: { id: true } }))) {
      throw new NotFoundException({ message: 'Medicine not found', code: 'MEDICINE_NOT_FOUND' });
    }
    await this.guardRate(user.id);
    const verdict = moderateText(`${input.title ?? ''} ${input.body}`);
    const review = await this.prisma.review.create({
      data: {
        authorId: user.id,
        target: 'MEDICINE',
        medicineId,
        rating: input.rating,
        title: input.title,
        body: input.body,
        language: input.language,
        countryCode: input.countryCode,
        status: verdict.hold ? 'PENDING' : 'PUBLISHED',
        moderationNote: verdict.hold ? `auto: ${verdict.reasons.join(', ')}` : null,
      },
    });
    return { id: review.id, status: review.status };
  }

  async createForPharmacy(user: RequestUser, pharmacyId: string, input: PharmacyReviewInput) {
    if (!(await this.prisma.pharmacy.findUnique({ where: { id: pharmacyId }, select: { id: true } }))) {
      throw new NotFoundException({ message: 'Pharmacy not found', code: 'PHARMACY_NOT_FOUND' });
    }
    await this.guardRate(user.id);
    const verdict = moderateText(`${input.title ?? ''} ${input.body}`);
    const review = await this.prisma.review.create({
      data: {
        authorId: user.id,
        target: 'PHARMACY',
        pharmacyId,
        rating: input.rating,
        title: input.title,
        body: input.body,
        language: input.language,
        countryCode: input.countryCode,
        staffRating: input.staffRating,
        serviceRating: input.serviceRating,
        waitingRating: input.waitingRating,
        cleanlinessRating: input.cleanlinessRating,
        accessibilityRating: input.accessibilityRating,
        status: verdict.hold ? 'PENDING' : 'PUBLISHED',
        moderationNote: verdict.hold ? `auto: ${verdict.reasons.join(', ')}` : null,
      },
    });
    return { id: review.id, status: review.status };
  }

  async toggleHelpful(user: RequestUser, reviewId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.status !== 'PUBLISHED') throw new NotFoundException({ message: 'Review not found', code: 'REVIEW_NOT_FOUND' });
    if (review.authorId === user.id) throw new ForbiddenException({ message: 'You cannot vote on your own review', code: 'OWN_REVIEW' });
    const key = { reviewId_userId: { reviewId, userId: user.id } };
    const existing = await this.prisma.reviewVote.findUnique({ where: key });
    if (existing) {
      await this.prisma.$transaction([
        this.prisma.reviewVote.delete({ where: key }),
        this.prisma.review.update({ where: { id: reviewId }, data: { helpfulCount: { decrement: 1 } } }),
      ]);
      return { voted: false };
    }
    await this.prisma.$transaction([
      this.prisma.reviewVote.create({ data: { reviewId, userId: user.id } }),
      this.prisma.review.update({ where: { id: reviewId }, data: { helpfulCount: { increment: 1 } } }),
    ]);
    return { voted: true };
  }

  async report(user: RequestUser, reviewId: string, reason: Prisma.ReviewReportCreateInput['reason'], details?: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException({ message: 'Review not found', code: 'REVIEW_NOT_FOUND' });
    await this.prisma.reviewReport.upsert({
      where: { reviewId_reporterId: { reviewId, reporterId: user.id } },
      update: { reason, details },
      create: { reviewId, reporterId: user.id, reason, details },
    });
    // Three independent reports hide the review until a moderator decides.
    const open = await this.prisma.reviewReport.count({ where: { reviewId, status: 'OPEN' } });
    if (open >= 3 && review.status === 'PUBLISHED') {
      await this.prisma.review.update({ where: { id: reviewId }, data: { status: 'PENDING', moderationNote: 'auto: hidden after 3 reports' } });
    }
    return { reported: true };
  }

  async deleteOwn(user: RequestUser, reviewId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.authorId !== user.id) throw new NotFoundException({ message: 'Review not found', code: 'REVIEW_NOT_FOUND' });
    await this.prisma.review.delete({ where: { id: reviewId } });
  }
}
