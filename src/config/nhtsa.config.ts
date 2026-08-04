import { registerAs } from '@nestjs/config';

const nhtsaConfig = registerAs('nhtsa', () => ({
  allMakesUrl:
    process.env.NHTSA_ALL_MAKES_URL ??
    'https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=xml',
  vehicleTypesBaseUrl:
    process.env.NHTSA_VEHICLE_TYPES_BASE_URL ??
    'https://vpic.nhtsa.dot.gov/api/vehicles/GetVehicleTypesForMakeId/{makeId}?format=xml',
  timeoutMs: parseInt(process.env.HTTP_TIMEOUT_MS ?? '10000', 10),
  ingestionConcurrency: parseInt(process.env.INGESTION_CONCURRENCY ?? '5', 10),
  ingestOnStartup: process.env.INGEST_ON_STARTUP === 'true',
}));

export default nhtsaConfig;
