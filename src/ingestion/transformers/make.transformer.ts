import { Injectable } from '@nestjs/common';

import {
  NhtsaAllMakesItem,
  NhtsaAllMakesXmlResponse,
  OneOrMany,
} from '../types/nhtsa-response.types';
import { TransformedMake } from '../types/transformed.types';

@Injectable()
export class MakeTransformer {
  transform(response: NhtsaAllMakesXmlResponse): TransformedMake[] {
    const items = response.Response.Results.AllVehicleMakes;

    if (!items) {
      return [];
    }

    return this.toArray(items).map((item) => this.transformItem(item));
  }

  private transformItem(item: NhtsaAllMakesItem): TransformedMake {
    return {
      makeId: item.Make_ID,
      makeName: item.Make_Name.trim(),
    };
  }

  private toArray<T>(value: OneOrMany<T>): T[] {
    return Array.isArray(value) ? value : [value];
  }
}