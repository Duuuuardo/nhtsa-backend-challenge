export interface IngestionSaveSummary {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly errors: readonly string[];
}
