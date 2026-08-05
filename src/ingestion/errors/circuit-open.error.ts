import { IngestionError } from './ingestion.error';

export class CircuitOpenError extends IngestionError {
  readonly code = 'NHTSA_CIRCUIT_OPEN';

  constructor(
    public readonly retryAfterMs: number,
    message = 'NHTSA circuit breaker is open',
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}
