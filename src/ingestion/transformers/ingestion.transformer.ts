import { Injectable } from '@nestjs/common';

import {
  TransformedMake,
  TransformedMakeWithVehicleTypes,
  TransformedVehicleType,
} from '../types/transformed.types';

@Injectable()
export class IngestionTransformer {
  merge(
    makes: TransformedMake[],
    vehicleTypesByMake: Map<number, TransformedVehicleType[]>,
  ): TransformedMakeWithVehicleTypes[] {
    return makes.map((make) => ({
      ...make,
      vehicleTypes: vehicleTypesByMake.get(make.makeId) ?? [],
    }));
  }
}
