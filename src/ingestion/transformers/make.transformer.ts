import { Injectable } from '@nestjs/common';

import {
  NhtsaAllMakesItem,
  NhtsaAllMakesXmlResponse,
} from '../types/nhtsa-response.types';
import { TransformedMake } from '../types/transformed.types';
import { toArray } from '../utils/one-or-many.util';

@Injectable()
export class MakeTransformer {
  transform(response: NhtsaAllMakesXmlResponse): TransformedMake[] {
    const items = response.Response.Results.AllVehicleMakes;

    if (!items) {
      return [];
    }

    return toArray(items).map((item) => this.transformItem(item));
  }

  private transformItem(item: NhtsaAllMakesItem): TransformedMake {
    return {
      makeId: item.Make_ID,
      makeName: String(item.Make_Name).trim(),
    };
  }
}
