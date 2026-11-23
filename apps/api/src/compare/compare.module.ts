import { Module } from '@nestjs/common';
import { MedicinesModule } from '../medicines/medicines.module';
import { CompareController } from './compare.controller';
import { CompareService } from './compare.service';

@Module({ imports: [MedicinesModule], controllers: [CompareController], providers: [CompareService] })
export class CompareModule {}
