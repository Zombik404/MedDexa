import { Module } from '@nestjs/common';
import { MedicinesModule } from '../medicines/medicines.module';
import { PharmaciesModule } from '../pharmacies/pharmacies.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({ imports: [MedicinesModule, PharmaciesModule], controllers: [MeController], providers: [MeService] })
export class MeModule {}
