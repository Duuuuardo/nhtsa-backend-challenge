import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function getPackageVersion(): string | undefined {
  try {
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      version?: string;
    };
    return packageJson.version;
  } catch {
    return undefined;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useLogger(app.get(Logger));

  const logger = app.get(Logger);
  process.on('unhandledRejection', (reason: Error) => {
    logger.fatal({ event: 'app.unhandledRejection', error: reason });
    setTimeout(() => process.exit(1), 100);
  });

  process.on('uncaughtException', (err: Error) => {
    logger.fatal({ event: 'app.uncaughtException', error: err });
    setTimeout(() => process.exit(1), 100);
  });

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('app.port');
  const environment = configService.getOrThrow<string>('app.environment');
  const version =
    process.env.npm_package_version ?? getPackageVersion() ?? 'unknown';

  await app.listen(port);
  logger.log({ event: 'app.started', port, environment, version });
}
void bootstrap();
