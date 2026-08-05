export interface IngestionResult {
  readonly makesProcessed: number;
  readonly vehicleTypeFetchFailures: number;
  readonly persisted: number;
  readonly persistenceFailures: number;
  readonly stoppedEarly?: boolean;
  readonly stopReason?: 'circuitOpen';
}
