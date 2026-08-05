import { Injectable } from '@nestjs/common';
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
  TransformedMakeWithVehicleTypes,
  TransformedVehicleType,
} from '../types/transformed.types';

@Injectable()
export class IngestionService {
  private readonly concurrency = 5;

  constructor(
    private readonly nhtsaClient: NhtsaClient,
    private readonly xmlParser: XmlParser,
    private readonly makeTransformer: MakeTransformer,
    private readonly vehicleTypeTransformer: VehicleTypeTransformer,
    private readonly ingestionTransformer: IngestionTransformer,
    private readonly ingestionRepository: IngestionRepository,
  ) {}

  async ingest(): Promise<TransformedMakeWithVehicleTypes[]> {
    const allMakesXml = await this.nhtsaClient.getAllMakesXml();

    const parsedMakes =
      this.xmlParser.parse<NhtsaAllMakesXmlResponse>(allMakesXml);

    const makes = this.makeTransformer.transform(parsedMakes);

    const vehicleTypesByMake =
      new Map<number, TransformedVehicleType[]>();

    const limit = pLimit(this.concurrency);

    const fetchTasks = makes.map((make) =>
      limit(async () => {
        try {
          const vehicleTypes = await this.fetchVehicleTypes(
            make.makeId,
          );

          vehicleTypesByMake.set(make.makeId, vehicleTypes);
        } catch {
          vehicleTypesByMake.set(make.makeId, []);
        }
      }),
    );

    await Promise.all(fetchTasks);

    const result = this.ingestionTransformer.merge(
      makes,
      vehicleTypesByMake,
    );

    await this.ingestionRepository.save(result);

    return result;
  }

  private async fetchVehicleTypes(
    makeId: number,
  ): Promise<TransformedVehicleType[]> {
    const xml =
      await this.nhtsaClient.getVehicleTypesXml(makeId);

    const parsed =
      this.xmlParser.parse<NhtsaVehicleTypesXmlResponse>(xml);

    return this.vehicleTypeTransformer.transform(parsed);
  }
}