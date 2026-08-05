import { registerAs } from '@nestjs/config';

export default registerAs('ingestion', () => ({
  concurrency: Number(process.env.INGESTION_CONCURRENCY ?? 2),
  batchSize: Number(process.env.INGESTION_BATCH_SIZE ?? 25),
  requestDelayMs: Number(process.env.INGESTION_REQUEST_DELAY_MS ?? 500),
  transactionTimeoutMs: Number(
    process.env.INGESTION_TRANSACTION_TIMEOUT_MS ?? 10000,
  ),
  maxMakes: Number(process.env.INGESTION_MAX_MAKES ?? 0),
  ingestOnStartup: process.env.INGEST_ON_STARTUP === 'true',
}));
