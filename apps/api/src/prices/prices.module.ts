import { Global, Module } from '@nestjs/common';
import { FxService } from './fx.service';
import { PricesService } from './prices.service';

@Global()
@Module({ providers: [FxService, PricesService], exports: [FxService, PricesService] })
export class PricesModule {}
