import { registerAs } from '@nestjs/config';

const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));

export default databaseConfig;
