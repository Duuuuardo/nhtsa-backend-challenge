import { registerAs } from '@nestjs/config';

export default registerAs('nhtsa', () => ({
  allMakesUrl:
    process.env.NHTSA_ALL_MAKES_URL ??
    'https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=xml',
  vehicleTypesBaseUrl:
    process.env.NHTSA_VEHICLE_TYPES_BASE_URL ??
    'https://vpic.nhtsa.dot.gov/api/vehicles/GetVehicleTypesForMakeId/{makeId}?format=xml',
  requestTimeoutMs: Number(process.env.NHTSA_REQUEST_TIMEOUT_MS ?? 30000),
  maxRetries: Number(process.env.NHTSA_MAX_RETRIES ?? 3),
  retryBaseDelayMs: Number(process.env.NHTSA_RETRY_BASE_DELAY_MS ?? 1000),
  breakerFailureThreshold: Number(
    process.env.NHTSA_BREAKER_FAILURE_THRESHOLD ?? 5,
  ),
  breakerResetMs: Number(process.env.NHTSA_BREAKER_RESET_MS ?? 30000),
}));
