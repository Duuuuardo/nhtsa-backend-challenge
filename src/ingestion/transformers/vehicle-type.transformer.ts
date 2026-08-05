import { Injectable } from '@nestjs/common';

import {
  NhtsaVehicleTypeItem,
  NhtsaVehicleTypesXmlResponse,
  OneOrMany,
} from '../types/nhtsa-response.types';
import { TransformedVehicleType } from '../types/transformed.types';

@Injectable()
export class VehicleTypeTransformer {
  transform(
    response: NhtsaVehicleTypesXmlResponse,
  ): TransformedVehicleType[] {
    const items = response.Response.Results.VehicleTypesForMakeIds;

    if (!items) {
      return [];
    }

    return this.toArray(items).map((item) =>
      this.transformItem(item),
    );
  }

  private transformItem(
    item: NhtsaVehicleTypeItem,
  ): TransformedVehicleType {
    return {
      typeId: item.VehicleTypeId,
      typeName: String(item.VehicleTypeName).trim(),
    };
  }

  private toArray<T>(value: OneOrMany<T>): T[] {
    return Array.isArray(value) ? value : [value];
  }
}