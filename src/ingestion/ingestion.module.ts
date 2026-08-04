import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { NhtsaClient } from './clients/nhtsa.client';
import { XmlParser } from './parsers/xml.parser';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 3,
    }),
  ],
  providers: [NhtsaClient, XmlParser],
  exports: [NhtsaClient, XmlParser],
})
export class IngestionModule {}