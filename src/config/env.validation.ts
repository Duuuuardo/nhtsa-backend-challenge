import * as Joi from 'joi';
import { vehicleTypesUrlValidator } from './validators';

const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  NHTSA_ALL_MAKES_URL: Joi.string()
    .uri()
    .default('https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=xml'),
  NHTSA_VEHICLE_TYPES_BASE_URL: vehicleTypesUrlValidator,
  NHTSA_REQUEST_TIMEOUT_MS: Joi.number().integer().positive().default(30000),
  NHTSA_MAX_RETRIES: Joi.number().integer().min(0).max(5).default(3),
  NHTSA_RETRY_BASE_DELAY_MS: Joi.number().integer().positive().default(1000),
  NHTSA_BREAKER_FAILURE_THRESHOLD: Joi.number().integer().min(1).default(5),
  NHTSA_BREAKER_RESET_MS: Joi.number().integer().min(1000).default(30000),
  INGESTION_CONCURRENCY: Joi.number().integer().min(1).max(10).default(2),
  INGESTION_BATCH_SIZE: Joi.number().integer().min(1).max(500).default(25),
  INGESTION_REQUEST_DELAY_MS: Joi.number().integer().min(0).default(500),
  INGESTION_MAX_MAKES: Joi.number().integer().min(0).default(0),
  INGESTION_TRANSACTION_TIMEOUT_MS: Joi.number()
    .integer()
    .positive()
    .min(1000)
    .default(10000),
  INGEST_ON_STARTUP: Joi.boolean().truthy('true').falsy('false').default(false),
});

export { envValidationSchema };
