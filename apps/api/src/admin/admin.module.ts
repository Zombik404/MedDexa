import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminOpsController } from './admin-ops.controller';

@Module({ imports: [IntegrationsModule], controllers: [AdminCatalogController, AdminOpsController] })
export class AdminModule {}
