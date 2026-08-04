import { IngestionService } from './ingestion.service';
import {
  TransformedMake,
  TransformedVehicleType,
} from '../types/transformed.types';

describe('IngestionService', () => {
  let service: IngestionService;

  const nhtsaClient = {
    getAllMakesXml: jest.fn(),
    getVehicleTypesXml: jest.fn(),
  };

  const xmlParser = {
    parse: jest.fn(),
  };

  const makeTransformer = {
    transform: jest.fn(),
  };

  const vehicleTypeTransformer = {
    transform: jest.fn(),
  };

  const ingestionTransformer = {
    merge: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new IngestionService(
      nhtsaClient as never,
      xmlParser as never,
      makeTransformer as never,
      vehicleTypeTransformer as never,
      ingestionTransformer as never,
    );
  });

  it('should ingest and combine makes with their vehicle types', async () => {
    const makesXml = '<xml>makes data</xml>';
    const vehicleTypesXml440 = '<xml>vehicle types for 440</xml>';
    const vehicleTypesXml441 = '<xml>vehicle types for 441</xml>';

    const parsedMakes = {
      Response: {
        Count: 2,
        Message: 'Success',
        Results: {},
      },
    };

    const parsedVehicleTypes440 = {
      Response: {
        Count: 1,
        Message: 'Success',
        Results: {},
      },
    };

    const parsedVehicleTypes441 = {
      Response: {
        Count: 1,
        Message: 'Success',
        Results: {},
      },
    };

    const makes = [
      { makeId: 440, makeName: 'ASTON MARTIN' },
      { makeId: 441, makeName: 'TESLA' },
    ];

    const vehicleTypes440 = [
      { typeId: 2, typeName: 'Passenger Car' },
    ];

    const vehicleTypes441 = [
      { typeId: 3, typeName: 'Truck' },
    ];

    const finalResult = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes: [
          { typeId: 2, typeName: 'Passenger Car' },
        ],
      },
      {
        makeId: 441,
        makeName: 'TESLA',
        vehicleTypes: [
          { typeId: 3, typeName: 'Truck' },
        ],
      },
    ];

    nhtsaClient.getAllMakesXml.mockResolvedValue(makesXml);
    xmlParser.parse.mockImplementation((xml: string) => {
      if (xml === makesXml) {
        return parsedMakes;
      }

      if (xml === vehicleTypesXml440) {
        return parsedVehicleTypes440;
      }

      if (xml === vehicleTypesXml441) {
        return parsedVehicleTypes441;
      }

      throw new Error('Unexpected XML');
    });
    makeTransformer.transform.mockReturnValue(makes);
    nhtsaClient.getVehicleTypesXml.mockImplementation(async (makeId: number) => {
      if (makeId === 440) return vehicleTypesXml440;
      if (makeId === 441) return vehicleTypesXml441;
      throw new Error(`Unexpected makeId: ${makeId}`);
    });
    vehicleTypeTransformer.transform.mockImplementation((parsed) => {
      if (parsed === parsedVehicleTypes440) {
        return vehicleTypes440;
      }

      if (parsed === parsedVehicleTypes441) {
        return vehicleTypes441;
      }

      return [];
    });
    ingestionTransformer.merge.mockReturnValue(finalResult);

    const result = await service.ingest();

    expect(result).toEqual(finalResult);
    expect(nhtsaClient.getAllMakesXml).toHaveBeenCalledTimes(1);
    expect(xmlParser.parse).toHaveBeenCalledWith(makesXml);
    expect(makeTransformer.transform).toHaveBeenCalledWith(parsedMakes);
    expect(nhtsaClient.getVehicleTypesXml).toHaveBeenCalledTimes(2);
    expect(nhtsaClient.getVehicleTypesXml).toHaveBeenCalledWith(440);
    expect(nhtsaClient.getVehicleTypesXml).toHaveBeenCalledWith(441);
    expect(ingestionTransformer.merge).toHaveBeenCalledTimes(1);
    expect(ingestionTransformer.merge).toHaveBeenCalledWith(
      makes,
      expect.any(Map),
    );

    const [, receivedMap] =
      ingestionTransformer.merge.mock.calls[0] as [
        typeof makes,
        Map<number, typeof vehicleTypes440>,
      ];

    expect(receivedMap.get(440)).toEqual(vehicleTypes440);
    expect(receivedMap.get(441)).toEqual(vehicleTypes441);
  });

  it('should not fetch vehicle types when no makes are returned', async () => {
    const makesXml = '<xml>no makes</xml>';
    const parsedMakes = {
      Response: {
        Count: 0,
        Message: 'Success',
        Results: {},
      },
    };

    const makes: TransformedMake[] = [];

    nhtsaClient.getAllMakesXml.mockResolvedValue(makesXml);
    xmlParser.parse.mockReturnValue(parsedMakes);
    makeTransformer.transform.mockReturnValue(makes);
    ingestionTransformer.merge.mockReturnValue([]);

    const result = await service.ingest();

    expect(result).toEqual([]);
    expect(nhtsaClient.getAllMakesXml).toHaveBeenCalledTimes(1);
    expect(xmlParser.parse).toHaveBeenCalledWith(makesXml);
    expect(makeTransformer.transform).toHaveBeenCalledWith(parsedMakes);
    expect(nhtsaClient.getVehicleTypesXml).not.toHaveBeenCalled();
    expect(ingestionTransformer.merge).toHaveBeenCalledWith(
      makes,
      expect.any(Map),
    );

    const [, receivedMap] =
      ingestionTransformer.merge.mock.calls[0] as [
        TransformedMake[],
        Map<number, TransformedVehicleType[]>,
      ];

    expect(receivedMap.size).toBe(0);
  });

  it('should continue when fetching vehicle types for one make fails', async () => {
    const makesXml = '<xml>makes data</xml>';
    const vehicleTypesXml440 = '<xml>vehicle types for 440</xml>';

    const parsedMakes = {
      Response: {
        Count: 2,
        Message: 'Success',
        Results: {},
      },
    };

    const parsedVehicleTypes440 = {
      Response: {
        Count: 1,
        Message: 'Success',
        Results: {},
      },
    };

    const makes = [
      { makeId: 440, makeName: 'ASTON MARTIN' },
      { makeId: 441, makeName: 'TESLA' },
    ];

    const vehicleTypes440 = [
      { typeId: 2, typeName: 'Passenger Car' },
    ];

    const finalResult = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes: vehicleTypes440,
      },
      {
        makeId: 441,
        makeName: 'TESLA',
        vehicleTypes: [],
      },
    ];

    nhtsaClient.getAllMakesXml.mockResolvedValue(makesXml);
    xmlParser.parse.mockImplementation((xml: string) => {
      if (xml === makesXml) {
        return parsedMakes;
      }

      if (xml === vehicleTypesXml440) {
        return parsedVehicleTypes440;
      }

      throw new Error('Unexpected XML');
    });
    makeTransformer.transform.mockReturnValue(makes);
    nhtsaClient.getVehicleTypesXml.mockImplementation(async (makeId: number) => {
      if (makeId === 440) return vehicleTypesXml440;
      if (makeId === 441) throw new Error('Vehicle types fetch failed');
      throw new Error(`Unexpected makeId: ${makeId}`);
    });
    vehicleTypeTransformer.transform.mockImplementation((parsed) => {
      if (parsed === parsedVehicleTypes440) {
        return vehicleTypes440;
      }

      return [];
    });
    ingestionTransformer.merge.mockReturnValue(finalResult);

    const result = await service.ingest();

    expect(result).toEqual(finalResult);
    expect(nhtsaClient.getVehicleTypesXml).toHaveBeenCalledWith(440);
    expect(nhtsaClient.getVehicleTypesXml).toHaveBeenCalledWith(441);
    expect(ingestionTransformer.merge).toHaveBeenCalledWith(
      makes,
      expect.any(Map),
    );

    const [, receivedMap] =
      ingestionTransformer.merge.mock.calls[0] as [
        TransformedMake[],
        Map<number, TransformedVehicleType[]>,
      ];

    expect(receivedMap.get(440)).toEqual(vehicleTypes440);
    expect(receivedMap.get(441)).toEqual([]);
  });

  it('should propagate the error when fetching all makes fails', async () => {
    const error = new Error('NHTSA error');

    nhtsaClient.getAllMakesXml.mockRejectedValue(error);

    await expect(service.ingest()).rejects.toThrow('NHTSA error');
    expect(xmlParser.parse).not.toHaveBeenCalled();
    expect(makeTransformer.transform).not.toHaveBeenCalled();
    expect(nhtsaClient.getVehicleTypesXml).not.toHaveBeenCalled();
    expect(ingestionTransformer.merge).not.toHaveBeenCalled();
  });
});
