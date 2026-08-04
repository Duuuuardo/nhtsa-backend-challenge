import * as Joi from 'joi';

const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  NHTSA_ALL_MAKES_URL: Joi.string()
    .uri()
    .default('https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=xml'),
  NHTSA_VEHICLE_TYPES_BASE_URL: Joi.string()
    .uri()
    .default(
      'https://vpic.nhtsa.dot.gov/api/vehicles/GetVehicleTypesForMakeId',
    ),
  HTTP_TIMEOUT_MS: Joi.number().integer().min(1000),
  INGESTION_CONCURRENCY: Joi.number().integer().min(1).max(20).default(5),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  INGEST_ON_STARTUP: Joi.boolean().default(false),
});

export { envValidationSchema };
