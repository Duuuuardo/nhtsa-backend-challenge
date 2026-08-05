import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import appConfig from './config/app.config';
import nhtsaConfig from './config/nhtsa.config';
import databaseConfig from './config/database.config';
import ingestionConfig from './config/ingestion.config';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { ApolloDriver } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';
import { IncomingMessage } from 'http';
import { MakesModule } from './makes/makes.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, nhtsaConfig, databaseConfig, ingestionConfig],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
    PrismaModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const level = config.get<string>('app.logLevel');
        const environment = config.get<string>('app.environment');
        return {
          pinoHttp: {
            level,
            transport:
              environment !== 'production'
                ? { target: 'pino-pretty', options: { colorize: true } }
                : undefined,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            autoLogging: {
              ignore: (req: IncomingMessage): boolean =>
                req.url?.startsWith('/graphql') ?? false,
            },
          },
        };
      },
    }),
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
    }),
    MakesModule,
    IngestionModule,
  ],
})
export class AppModule {}
