export type OneOrMany<T> = T | T[];

export interface NhtsaResponseMetadata {
  Count: number;
  Message: string;
  SearchCriteria?: string;
}

export interface NhtsaAllMakesItem {
  Make_ID: number;
  Make_Name: string;
}

export interface NhtsaAllMakesXmlResponse {
  Response: NhtsaResponseMetadata & {
    Results: {
      AllVehicleMakes?: OneOrMany<NhtsaAllMakesItem>;
    };
  };
}

export interface NhtsaVehicleTypeItem {
  VehicleTypeId: number;
  VehicleTypeName: string;
}

export interface NhtsaVehicleTypesXmlResponse {
  Response: NhtsaResponseMetadata & {
    Results: {
      VehicleTypesForMakeIds?: OneOrMany<NhtsaVehicleTypeItem>;
    };
  };
}