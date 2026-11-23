import { Module } from '@nestjs/common';
import { IngredientsController, MedicinesController } from './medicines.controller';
import { LookupService } from './lookup.service';
import { MedicinesService } from './medicines.service';
import { OcrService } from './ocr.service';
import { SearchService } from './search.service';

@Module({
  controllers: [MedicinesController, IngredientsController],
  providers: [MedicinesService, SearchService, LookupService, OcrService],
  exports: [MedicinesService],
})
export class MedicinesModule {}
