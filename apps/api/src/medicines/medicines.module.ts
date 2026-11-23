import { Module } from '@nestjs/common';
import { MedicinesController } from './medicines.controller';
import { MedicinesService } from './medicines.service';
import { SearchService } from './search.service';

@Module({ controllers: [MedicinesController], providers: [MedicinesService, SearchService], exports: [MedicinesService] })
export class MedicinesModule {}
