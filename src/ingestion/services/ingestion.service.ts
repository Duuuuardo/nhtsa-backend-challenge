import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pLimit from 'p-limit';

import { NhtsaClient } from '../clients/nhtsa.client';
import { XmlParser } from '../parsers/xml.parser';
import { IngestionRepository } from '../repositories/ingestion.repository';
import { IngestionTransformer } from '../transformers/ingestion.transformer';
import { MakeTransformer } from '../transformers/make.transformer';
import { VehicleTypeTransformer } from '../transformers/vehicle-type.transformer';
import {
  NhtsaAllMakesXmlResponse,
  NhtsaVehicleTypesXmlResponse,
} from '../types/nhtsa-response.types';
import {
  TransformedMake,
  TransformedVehicleType,
} from '../types/transformed.types';
import { IngestionResult } from '../types/ingestion-result.types';
import {
  CircuitOpenError,
  IngestionFailedError,
  NhtsaRequestError,
  XmlParseError,
} from '../errors';

type ProcessChunkResult = {
  makesProcessed: number;
  vehicleTypeFetchFailures: number;
  persisted: number;
  persistenceFailures: number;
  stoppedEarly: boolean;
  stopReason?: 'circuitOpen';
};

@Injectable()
export class IngestionService implements OnApplicationBootstrap {
  private readonly concurrency: number;
  private readonly requestDelayMs: number;
  private readonly maxMakes: number;
  private readonly batchSize: number;
  private readonly ingestOnStartup: boolean;
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly nhtsaClient: NhtsaClient,
    private readonly xmlParser: XmlParser,
    private readonly makeTransformer: MakeTransformer,
    private readonly vehicleTypeTransformer: VehicleTypeTransformer,
    private readonly ingestionTransformer: IngestionTransformer,
    private readonly ingestionRepository: IngestionRepository,
    private readonly configService: ConfigService,
  ) {
    this.concurrency = this.configService.getOrThrow<number>(
      'ingestion.concurrency',
    );

    this.requestDelayMs = this.configService.getOrThrow<number>(
      'ingestion.requestDelayMs',
    );

    this.maxMakes = this.configService.getOrThrow<number>('ingestion.maxMakes');

    this.batchSize = this.configService.getOrThrow<number>(
      'ingestion.batchSize',
    );

    this.ingestOnStartup = this.configService.getOrThrow<boolean>(
      'ingestion.ingestOnStartup',
    );
  }

  onApplicationBootstrap(): void {
    if (!this.ingestOnStartup) {
      return;
    }

    this.logger.log({
      event: 'ingestion.automatic.start',
      ingestOnStartup: true,
    });

    this.ingest()
      .then((res) =>
        this.logger.log({
          event: 'ingestion.automatic.completed',
          makesProcessed: res.makesProcessed,
          persisted: res.persisted,
          persistenceFailures: res.persistenceFailures,
        }),
      )
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);

        this.logger.error({
          event: 'ingestion.automatic.failed',
          error: errorMessage,
        });
      });
  }

  async ingest(): Promise<IngestionResult> {
    const allMakesXml = await this.nhtsaClient.getAllMakesXml();
    const makes = this.buildMakes(allMakesXml);

    this.logger.log({
      event: 'ingestion.start',
      makesToProcess: makes.length,
      batchSize: this.batchSize,
    });

    let vehicleTypeFetchFailures = 0;
    let persisted = 0;
    let persistenceFailures = 0;

    for (let offset = 0; offset < makes.length; offset += this.batchSize) {
      const chunk = makes.slice(offset, offset + this.batchSize);

      const chunkResult = await this.processChunk(chunk, offset);

      if (chunkResult.stoppedEarly) {
        return {
          makesProcessed: chunkResult.makesProcessed,
          vehicleTypeFetchFailures:
            vehicleTypeFetchFailures + chunkResult.vehicleTypeFetchFailures,
          persisted,
          persistenceFailures,
          stoppedEarly: true,
          stopReason: chunkResult.stopReason,
        };
      }

      vehicleTypeFetchFailures += chunkResult.vehicleTypeFetchFailures;
      persisted += chunkResult.persisted;
      persistenceFailures += chunkResult.persistenceFailures;

      const processed = offset + chunk.length;
      this.logger.debug({
        event: 'ingestion.chunk.processed',
        processed,
        total: makes.length,
        chunkSize: chunk.length,
        persisted,
        persistenceFailures,
        vehicleTypeFetchFailures,
      });
    }

    const total = persisted + persistenceFailures;

    if (persisted === 0 && total > 0) {
      this.logger.error({
        event: 'ingestion.completelyFailed',
        total,
        failed: persistenceFailures,
      });

      throw new IngestionFailedError({ total, failed: persistenceFailures });
    }

    const ingestionResult: IngestionResult = {
      makesProcessed: makes.length,
      vehicleTypeFetchFailures,
      persisted,
      persistenceFailures,
    };

    if (persistenceFailures > 0) {
      this.logger.warn({
        event: 'ingestion.partial',
        total,
        succeeded: persisted,
        failed: persistenceFailures,
      });
      return ingestionResult;
    }

    this.logger.log({
      event: 'ingestion.completed',
      total,
      succeeded: persisted,
      failed: persistenceFailures,
    });

    return ingestionResult;
  }

  private buildMakes(allMakesXml: string) {
    const parsedMakes =
      this.xmlParser.parse<NhtsaAllMakesXmlResponse>(allMakesXml);

    const allMakes = this.makeTransformer.transform(parsedMakes);

    return this.maxMakes > 0 ? allMakes.slice(0, this.maxMakes) : allMakes;
  }

  private async processChunk(
    chunk: TransformedMake[],
    offset: number,
  ): Promise<ProcessChunkResult> {
    const vehicleTypesByMake = new Map<number, TransformedVehicleType[]>();
    const limit = pLimit(this.concurrency);
    let vehicleTypeFetchFailures = 0;

    const fetchTasks = chunk.map((make) =>
      limit(async () => {
        try {
          const vehicleTypes = await this.fetchVehicleTypes(make.makeId);

          vehicleTypesByMake.set(make.makeId, vehicleTypes);
        } catch (err: unknown) {
          if (err instanceof CircuitOpenError) {
            throw err;
          }

          vehicleTypeFetchFailures += 1;

          const errorPayload = {
            event: 'ingestion.vehicleTypeFetch.failure',
            makeId: make.makeId,
            error: err instanceof Error ? err.message : String(err),
          };

          if (
            err instanceof XmlParseError ||
            err instanceof NhtsaRequestError
          ) {
            this.logger.warn(errorPayload);
          } else {
            this.logger.error(errorPayload);
          }

          vehicleTypesByMake.set(make.makeId, []);
        } finally {
          if (this.requestDelayMs > 0) {
            await this.sleep(this.requestDelayMs);
          }
        }
      }),
    );

    try {
      await Promise.all(fetchTasks);
    } catch (err: unknown) {
      if (err instanceof CircuitOpenError) {
        this.logger.warn({
          event: 'ingestion.stoppedEarly',
          reason: err.message,
          retryAfterMs: err.retryAfterMs,
        });

        return {
          makesProcessed: offset,
          vehicleTypeFetchFailures,
          persisted: 0,
          persistenceFailures: 0,
          stoppedEarly: true,
          stopReason: 'circuitOpen',
        };
      }

      throw err;
    }

    const result = this.ingestionTransformer.merge(chunk, vehicleTypesByMake);
    const summary = await this.ingestionRepository.save(result);

    if (summary.failed > 0) {
      this.logger.warn({
        event: 'ingestion.chunk.failure',
        chunkSize: chunk.length,
        succeeded: summary.succeeded,
        failed: summary.failed,
      });
    }

    return {
      makesProcessed: offset + chunk.length,
      vehicleTypeFetchFailures,
      persisted: summary.succeeded,
      persistenceFailures: summary.failed,
      stoppedEarly: false,
    };
  }

  private async fetchVehicleTypes(
    makeId: number,
  ): Promise<TransformedVehicleType[]> {
    const xml = await this.nhtsaClient.getVehicleTypesXml(makeId);

    const parsed = this.xmlParser.parse<NhtsaVehicleTypesXmlResponse>(xml);

    return this.vehicleTypeTransformer.transform(parsed);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
