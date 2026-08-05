import { IngestionError } from './ingestion.error';

export class NhtsaRequestError extends IngestionError {
  readonly code = 'NHTSA_REQUEST_FAILED';
  readonly operation: string;
  readonly url: string;
  readonly status?: number;
  readonly attempts: number;
  readonly retryable: boolean;

  constructor(params: {
    operation: string;
    url: string;
    attempts: number;
    retryable: boolean;
    status?: number;
    message?: string;
    cause?: unknown;
  }) {
    super(params.message ?? 'NHTSA request failed', { cause: params.cause });
    this.operation = params.operation;
    this.url = params.url;
    this.attempts = params.attempts;
    this.retryable = params.retryable;
    this.status = params.status;
  }
}
