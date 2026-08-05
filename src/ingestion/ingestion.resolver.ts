import { Mutation, Resolver } from '@nestjs/graphql';

import { IngestionResult } from './entities/ingestion-result.entity';
import { IngestionService } from './services/ingestion.service';

@Resolver()
export class IngestionResolver {
  constructor(private readonly ingestionService: IngestionService) {}

  @Mutation(() => IngestionResult, {
    name: 'ingestNhtsaData',
    description:
      "Reports what was ingested from NHTSA. The actual data can be queried via the 'makes' query.",
  })
  ingestNhtsaData(): Promise<IngestionResult> {
    return this.ingestionService.ingest();
  }
}
