import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MakeTransformer } from './transformers/make.transformer';
import { VehicleTypeTransformer } from './transformers/vehicle-type.transformer';
import { NhtsaClient } from './clients/nhtsa.client';
import { XmlParser } from './parsers/xml.parser';
import { IngestionTransformer } from './transformers/ingestion.transformer';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 3,
    }),
  ],
  providers: [NhtsaClient, XmlParser, MakeTransformer, VehicleTypeTransformer, IngestionTransformer],
  exports: [NhtsaClient, XmlParser, MakeTransformer, VehicleTypeTransformer, IngestionTransformer],
})
export class IngestionModule {}