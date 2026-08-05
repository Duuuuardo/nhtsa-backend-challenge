import {
  Injectable,
  OnApplicationBootstrap,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
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
import { TransformedVehicleType } from '../types/transformed.types';
import { IngestionResult } from '../types/ingestion-result.types';

@Injectable()
export class IngestionService implements OnApplicationBootstrap {
  private readonly concurrency: number;
  private readonly requestDelayMs: number;
  private readonly maxMakes: number;
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

    this.ingestOnStartup = this.configService.getOrThrow<boolean>(
      'ingestion.ingestOnStartup',
    );
  }

  onApplicationBootstrap(): void {
    if (!this.ingestOnStartup) {
      return;
    }

    this.logger.log('Automatic ingestion started (INGEST_ON_STARTUP=true)');

    this.ingest()
      .then((res) =>
        this.logger.log(
          `Automatic ingestion completed: makesProcessed=${res.makesProcessed} persisted=${res.persisted} persistenceFailures=${res.persistenceFailures}`,
        ),
      )
      .catch((err) => this.logger.error(`Automatic ingestion failed: ${err}`));
  }

  async ingest(): Promise<IngestionResult> {
    const allMakesXml = await this.nhtsaClient.getAllMakesXml();

    const parsedMakes =
      this.xmlParser.parse<NhtsaAllMakesXmlResponse>(allMakesXml);

    const allMakes = this.makeTransformer.transform(parsedMakes);

    const makes =
      this.maxMakes > 0 ? allMakes.slice(0, this.maxMakes) : allMakes;

    let vehicleTypeFetchFailures = 0;
    const vehicleTypesByMake = new Map<number, TransformedVehicleType[]>();

    const limit = pLimit(this.concurrency);

    const fetchTasks = makes.map((make) =>
      limit(async () => {
        try {
          const vehicleTypes = await this.fetchVehicleTypes(make.makeId);

          vehicleTypesByMake.set(make.makeId, vehicleTypes);
        } catch {
          vehicleTypeFetchFailures += 1;
          this.logger.warn(
            `Failed to fetch vehicle types for makeId=${make.makeId}`,
          );
          vehicleTypesByMake.set(make.makeId, []);
        } finally {
          if (this.requestDelayMs > 0) {
            await this.sleep(this.requestDelayMs);
          }
        }
      }),
    );

    await Promise.all(fetchTasks);

    const result = this.ingestionTransformer.merge(makes, vehicleTypesByMake);

    const summary = await this.ingestionRepository.save(result);

    if (summary.succeeded === 0 && summary.total > 0) {
      this.logger.error(
        `Ingestion completely failed: total=${summary.total} failed=${summary.failed}`,
      );

      throw new InternalServerErrorException(
        `Ingestion failed: total=${summary.total} failed=${summary.failed}`,
      );
    }

    const ingestionResult: IngestionResult = {
      makesProcessed: makes.length,
      vehicleTypeFetchFailures,
      persisted: summary.succeeded,
      persistenceFailures: summary.failed,
    };

    if (summary.failed > 0) {
      this.logger.warn(
        `Partial ingestion: total=${summary.total} succeeded=${summary.succeeded} failures=${summary.failed}`,
      );
      return ingestionResult;
    }

    this.logger.log(
      `Ingestion completed: total=${summary.total} succeeded=${summary.succeeded} failures=${summary.failed}`,
    );

    return ingestionResult;
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
