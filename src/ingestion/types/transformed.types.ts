export interface TransformedMake {
  makeId: number;
  makeName: string;
}

export interface TransformedVehicleType {
  typeId: number;
  typeName: string;
}

export interface TransformedMakeWithVehicleTypes extends TransformedMake {
  vehicleTypes: TransformedVehicleType[];
}
