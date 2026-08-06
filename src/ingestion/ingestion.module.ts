import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../database/prisma.module';
import { NhtsaClient } from './clients/nhtsa.client';
import { IngestionResolver } from './ingestion.resolver';
import { XmlParser } from './parsers/xml.parser';
import { IngestionRepository } from './repositories/ingestion.repository';
import { IngestionService } from './services/ingestion.service';
import { IngestionTransformer } from './transformers/ingestion.transformer';
import { MakeTransformer } from './transformers/make.transformer';
import { VehicleTypeTransformer } from './transformers/vehicle-type.transformer';

@Module({
  imports: [
    PrismaModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
  ],
  providers: [
    NhtsaClient,
    XmlParser,
    MakeTransformer,
    VehicleTypeTransformer,
    IngestionTransformer,
    IngestionService,
    IngestionResolver,
    IngestionRepository,
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
