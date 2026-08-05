import { NhtsaVehicleTypesXmlResponse } from '../types/nhtsa-response.types';
import { VehicleTypeTransformer } from './vehicle-type.transformer';

describe('VehicleTypeTransformer', () => {
  let transformer: VehicleTypeTransformer;

  beforeEach(() => {
    transformer = new VehicleTypeTransformer();
  });

  it('should transform multiple vehicle types', () => {
    const response: NhtsaVehicleTypesXmlResponse = {
      Response: {
        Count: 2,
        Message: 'Response returned successfully',
        SearchCriteria: 'Make ID: 440',
        Results: {
          VehicleTypesForMakeIds: [
            {
              VehicleTypeId: 2,
              VehicleTypeName: 'Passenger Car',
            },
            {
              VehicleTypeId: 7,
              VehicleTypeName: 'Multipurpose Passenger Vehicle',
            },
          ],
        },
      },
    };

    expect(transformer.transform(response)).toEqual([
      {
        typeId: 2,
        typeName: 'Passenger Car',
      },
      {
        typeId: 7,
        typeName: 'Multipurpose Passenger Vehicle',
      },
    ]);
  });

  it('should transform a single vehicle type', () => {
    const response: NhtsaVehicleTypesXmlResponse = {
      Response: {
        Count: 1,
        Message: 'Response returned successfully',
        SearchCriteria: 'Make ID: 12858',
        Results: {
          VehicleTypesForMakeIds: {
            VehicleTypeId: 6,
            VehicleTypeName: 'Trailer',
          },
        },
      },
    };

    expect(transformer.transform(response)).toEqual([
      {
        typeId: 6,
        typeName: 'Trailer',
      },
    ]);
  });

  it('should return an empty array when there are no vehicle types', () => {
    const response: NhtsaVehicleTypesXmlResponse = {
      Response: {
        Count: 0,
        Message: 'Response returned successfully',
        SearchCriteria: 'Make ID: 99999',
        Results: {},
      },
    };

    expect(transformer.transform(response)).toEqual([]);
  });

  it('should trim the vehicle type name', () => {
    const response: NhtsaVehicleTypesXmlResponse = {
      Response: {
        Count: 1,
        Message: 'Response returned successfully',
        SearchCriteria: 'Make ID: 12858',
        Results: {
          VehicleTypesForMakeIds: {
            VehicleTypeId: 6,
            VehicleTypeName: '  Trailer  ',
          },
        },
      },
    };

    expect(transformer.transform(response)).toEqual([
      {
        typeId: 6,
        typeName: 'Trailer',
      },
    ]);
  });
});
