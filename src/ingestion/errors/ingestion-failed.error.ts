import { IngestionError } from './ingestion.error';

export class IngestionFailedError extends IngestionError {
  readonly code = 'INGESTION_FAILED';
  readonly total: number;
  readonly failed: number;

  constructor(params: { total: number; failed: number; message?: string }) {
    super(params.message ?? 'Ingestion failed');
    this.total = params.total;
    this.failed = params.failed;
  }
}
