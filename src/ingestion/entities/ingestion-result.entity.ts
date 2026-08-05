import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class IngestionResult {
  @Field(() => Int, {
    description: 'Number of makes processed during ingestion',
  })
  makesProcessed!: number;

  @Field(() => Int, {
    description: 'Number of vehicle type fetch failures during ingestion',
  })
  vehicleTypeFetchFailures!: number;

  @Field(() => Int, {
    description: 'Number of records persisted during ingestion',
  })
  persisted!: number;

  @Field(() => Int, {
    description: 'Number of persistence failures during ingestion',
  })
  persistenceFailures!: number;
}

export default IngestionResult;
