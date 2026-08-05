import { Injectable } from '@nestjs/common';

import {
  NhtsaVehicleTypeItem,
  NhtsaVehicleTypesXmlResponse,
} from '../types/nhtsa-response.types';
import { TransformedVehicleType } from '../types/transformed.types';
import { toArray } from '../utils/one-or-many.util';

@Injectable()
export class VehicleTypeTransformer {
  transform(response: NhtsaVehicleTypesXmlResponse): TransformedVehicleType[] {
    const items = response.Response.Results.VehicleTypesForMakeIds;

    if (!items) {
      return [];
    }

    return toArray(items).map((item) => this.transformItem(item));
  }

  private transformItem(item: NhtsaVehicleTypeItem): TransformedVehicleType {
    return {
      typeId: item.VehicleTypeId,
      typeName: String(item.VehicleTypeName).trim(),
    };
  }
}
