import { registerAs } from '@nestjs/config';

const appConfig = registerAs('app', () => ({
  environment: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  logLevel: process.env.LOG_LEVEL ?? 'info',
}));

export default appConfig;
