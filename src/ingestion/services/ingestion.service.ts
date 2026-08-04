import { Injectable } from '@nestjs/common';
import pLimit from 'p-limit';
import { NhtsaClient } from '../clients/nhtsa.client';
import { XmlParser } from '../parsers/xml.parser';
import { MakeTransformer } from '../transformers/make.transformer';
import { VehicleTypeTransformer } from '../transformers/vehicle-type.transformer';
import { IngestionTransformer } from '../transformers/ingestion.transformer';
import { NhtsaAllMakesXmlResponse, NhtsaVehicleTypesXmlResponse } from '../types/nhtsa-response.types';
import { TransformedMakeWithVehicleTypes, TransformedVehicleType } from '../types/transformed.types';

@Injectable()
export class IngestionService {
  private readonly concurrency: number = 5;

  constructor(
    private readonly nhtsaClient: NhtsaClient,
    private readonly xmlParser: XmlParser,
    private readonly makeTransformer: MakeTransformer,
    private readonly vehicleTypeTransformer: VehicleTypeTransformer,
    private readonly ingestionTransformer: IngestionTransformer,
  ) {}

  async ingest(): Promise<TransformedMakeWithVehicleTypes[]> {
    const allMakesXml = await this.nhtsaClient.getAllMakesXml();

    const parsedMakes =
      this.xmlParser.parse<NhtsaAllMakesXmlResponse>(allMakesXml);

    const makes = this.makeTransformer.transform(parsedMakes);

    const vehicleTypesByMake = new Map<number, TransformedVehicleType[]>();

    const limit = pLimit(this.concurrency);

    const fetchTasks = makes.map((make) =>
      limit(async () => {
        try {
          const vehicleTypes = await this.fetchVehicleTypes(make.makeId);
          vehicleTypesByMake.set(make.makeId, vehicleTypes);
        } catch (error) {
          vehicleTypesByMake.set(make.makeId, []);
        }
      }),
    );

    await Promise.all(fetchTasks);

    return this.ingestionTransformer.merge(makes, vehicleTypesByMake);
  }

  private async fetchVehicleTypes(
    makeId: number,
  ): Promise<TransformedVehicleType[]> {
    const xml = await this.nhtsaClient.getVehicleTypesXml(makeId);

    const parsed =
      this.xmlParser.parse<NhtsaVehicleTypesXmlResponse>(xml);

    return this.vehicleTypeTransformer.transform(parsed);
  }
}
