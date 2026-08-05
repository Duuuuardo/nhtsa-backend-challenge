import { registerAs } from '@nestjs/config';

const appConfig = registerAs('app', () => ({
  environment: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  logPretty:
    typeof process.env.LOG_PRETTY !== 'undefined'
      ? ['1', 'true', 'yes'].includes(process.env.LOG_PRETTY.toLowerCase())
      : (process.env.NODE_ENV ?? 'development') !== 'production',
}));

export default appConfig;
