import { Body, Controller, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { compareRequestSchema, type CompareRequest } from '@meddexa/shared';
import { resolveCurrency } from '../common/currency';
import { CurrentUser, type RequestUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { CompareService } from './compare.service';

@ApiTags('compare')
@Controller('compare')
export class CompareController {
  constructor(private readonly compare: CompareService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Compare 2–6 medicines',
    description:
      'The first medicine is the reference. Signed-in users get the comparison saved to their history unless save=false. The result describes pharmaceutical characteristics and never recommends substitution.',
  })
  run(
    @Body(new ZodPipe(compareRequestSchema)) body: CompareRequest,
    @CurrentUser() user: RequestUser | null,
    @Query('save') save?: string,
  ) {
    return this.compare.compare(body.medicineIds, resolveCurrency(body.currency), user, save !== 'false');
  }
}
