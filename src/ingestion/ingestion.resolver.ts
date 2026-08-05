import { Mutation, Resolver } from '@nestjs/graphql';

import { Make } from '../makes/entities/make.entity';
import { IngestionService } from './services/ingestion.service';

@Resolver()
export class IngestionResolver {
  constructor(private readonly ingestionService: IngestionService) {}

  @Mutation(() => [Make], {
    name: 'ingestNhtsaData',
    description:
      'Fetches NHTSA XML data, transforms it and persists the result.',
  })
  ingestNhtsaData(): Promise<Make[]> {
    return this.ingestionService.ingest();
  }
}
