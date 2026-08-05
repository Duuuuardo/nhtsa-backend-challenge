import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  process.on('unhandledRejection', (reason: Error) => {
    const payload = {
      at: new Date().toISOString(),
      type: 'unhandledRejection',
      message: reason.message ?? String(reason),
      stack: reason.stack ?? undefined,
    };
    console.error(JSON.stringify(payload));
    setTimeout(() => process.exit(1), 100);
  });

  process.on('uncaughtException', (err: Error) => {
    const payload = {
      at: new Date().toISOString(),
      type: 'uncaughtException',
      message: err.message,
      stack: err.stack,
    };
    console.error(JSON.stringify(payload));
    setTimeout(() => process.exit(1), 100);
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);
}
void bootstrap();
