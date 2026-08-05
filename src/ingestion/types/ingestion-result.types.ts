export interface IngestionResult {
  readonly makesProcessed: number;
  readonly vehicleTypeFetchFailures: number;
  readonly persisted: number;
  readonly persistenceFailures: number;
}
