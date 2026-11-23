import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  comparisonHistorySchema,
  deleteAccountSchema,
  favoriteSchema,
  preferencesSchema,
  profileSchema,
  type PreferencesInput,
} from '@meddexa/shared';
import { resolveCurrency } from '../common/currency';
import { CurrentUser, RequireAuth, type RequestUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { MeService } from './me.service';

const pushSchema = z.object({ token: z.string().min(10).max(300), platform: z.enum(['ios', 'android', 'web']) });
const readSchema = z.object({ ids: z.array(z.string()).optional() });

@ApiTags('me')
@ApiBearerAuth()
@RequireAuth()
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  profile(@CurrentUser() u: RequestUser) {
    return this.me.profile(u.id);
  }

  @Patch()
  update(@CurrentUser() u: RequestUser, @Body(new ZodPipe(profileSchema)) body: { displayName?: string | null }) {
    return this.me.updateProfile(u.id, body);
  }

  @Patch('preferences')
  preferences(@CurrentUser() u: RequestUser, @Body(new ZodPipe(preferencesSchema)) body: PreferencesInput) {
    return this.me.updatePreferences(u.id, body);
  }

  @Get('favorites')
  favorites(@CurrentUser() u: RequestUser, @Query('currency') currency?: string) {
    return this.me.favorites(u.id, resolveCurrency(currency));
  }

  @Post('favorites')
  addFavorite(@CurrentUser() u: RequestUser, @Body(new ZodPipe(favoriteSchema)) body: { medicineId?: string; pharmacyId?: string }) {
    return this.me.addFavorite(u.id, body);
  }

  @Delete('favorites')
  @HttpCode(204)
  async removeFavoriteByTarget(@CurrentUser() u: RequestUser, @Query(new ZodPipe(favoriteSchema)) q: { medicineId?: string; pharmacyId?: string }) {
    await this.me.removeFavoriteByTarget(u.id, q);
  }

  @Delete('favorites/:id')
  @HttpCode(204)
  async removeFavorite(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    await this.me.removeFavorite(u.id, id);
  }

  @Get('search-history')
  searchHistory(@CurrentUser() u: RequestUser) {
    return this.me.searchHistory(u.id);
  }

  @Delete('search-history')
  @HttpCode(204)
  async clearSearchHistory(@CurrentUser() u: RequestUser) {
    await this.me.clearSearchHistory(u.id);
  }

  @Delete('search-history/:id')
  @HttpCode(204)
  async deleteSearch(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    await this.me.clearSearchHistory(u.id, id);
  }

  @Get('comparisons')
  comparisons(@CurrentUser() u: RequestUser) {
    return this.me.comparisons(u.id);
  }

  @Post('comparisons')
  saveComparison(@CurrentUser() u: RequestUser, @Body(new ZodPipe(comparisonHistorySchema)) body: { medicineIds: string[]; title?: string }) {
    return this.me.saveComparison(u.id, body.medicineIds, body.title);
  }

  @Delete('comparisons')
  @HttpCode(204)
  async clearComparisons(@CurrentUser() u: RequestUser) {
    await this.me.deleteComparison(u.id);
  }

  @Delete('comparisons/:id')
  @HttpCode(204)
  async deleteComparison(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    await this.me.deleteComparison(u.id, id);
  }

  @Get('recently-viewed')
  recentlyViewed(@CurrentUser() u: RequestUser, @Query('currency') currency?: string) {
    return this.me.recentlyViewed(u.id, resolveCurrency(currency));
  }

  @Delete('recently-viewed')
  @HttpCode(204)
  async clearRecentlyViewed(@CurrentUser() u: RequestUser) {
    await this.me.clearRecentlyViewed(u.id);
  }

  @Get('notifications')
  notifications(@CurrentUser() u: RequestUser) {
    return this.me.notifications(u.id);
  }

  @Post('notifications/read')
  @HttpCode(204)
  async markRead(@CurrentUser() u: RequestUser, @Body(new ZodPipe(readSchema)) body: { ids?: string[] }) {
    await this.me.markNotificationsRead(u.id, body.ids);
  }

  @Post('push-tokens')
  @HttpCode(204)
  async pushToken(@CurrentUser() u: RequestUser, @Body(new ZodPipe(pushSchema)) body: z.infer<typeof pushSchema>) {
    await this.me.registerPushToken(u.id, body.token, body.platform);
  }

  @Get('export')
  export(@CurrentUser() u: RequestUser) {
    return this.me.export(u.id);
  }

  @Post('delete')
  @HttpCode(204)
  async deleteAccount(@CurrentUser() u: RequestUser, @Body(new ZodPipe(deleteAccountSchema)) body: { password: string }) {
    await this.me.deleteAccount(u.id, body.password);
  }
}
