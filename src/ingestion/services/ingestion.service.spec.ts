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

  const ingestionRepository = {
    save: jest.fn(),
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

  const defaultConfig: Record<string, number | boolean> = {
    'ingestion.concurrency': 2,
    'ingestion.requestDelayMs': 0,
    'ingestion.maxMakes': 0,
    'ingestion.ingestOnStartup': false,
  };

  const configService: { getOrThrow: jest.Mock<number | boolean, [string]> } = {
    getOrThrow: jest.fn((key: string) => defaultConfig[key]),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    ingestionRepository.save.mockImplementation((makes: any[]) => ({
      total: Array.isArray(makes) ? makes.length : 0,
      succeeded: Array.isArray(makes) ? makes.length : 0,
      failed: 0,
      errors: [],
    }));

    service = new IngestionService(
      nhtsaClient as never,
      xmlParser as never,
      makeTransformer as never,
      vehicleTypeTransformer as never,
      ingestionTransformer,
      ingestionRepository as never,
      configService as never,
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
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
      },
      {
        makeId: 441,
        makeName: 'TESLA',
      },
    ];

    const vehicleTypes440 = [
      {
        typeId: 2,
        typeName: 'Passenger Car',
      },
    ];

    const vehicleTypes441 = [
      {
        typeId: 3,
        typeName: 'Truck',
      },
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
        vehicleTypes: vehicleTypes441,
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

    nhtsaClient.getVehicleTypesXml.mockImplementation((makeId: number) => {
      if (makeId === 440) {
        return vehicleTypesXml440;
      }

      if (makeId === 441) {
        return vehicleTypesXml441;
      }

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

    const [, receivedMap] = ingestionTransformer.merge.mock.calls[0] as [
      TransformedMake[],
      Map<number, TransformedVehicleType[]>,
    ];

    expect(receivedMap.get(440)).toEqual(vehicleTypes440);
    expect(receivedMap.get(441)).toEqual(vehicleTypes441);

    expect(ingestionRepository.save).toHaveBeenCalledTimes(1);

    expect(ingestionRepository.save).toHaveBeenCalledWith(finalResult);
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

    const [, receivedMap] = ingestionTransformer.merge.mock.calls[0] as [
      TransformedMake[],
      Map<number, TransformedVehicleType[]>,
    ];

    expect(receivedMap.size).toBe(0);

    expect(ingestionRepository.save).toHaveBeenCalledTimes(1);
    expect(ingestionRepository.save).toHaveBeenCalledWith([]);
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
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
      },
      {
        makeId: 441,
        makeName: 'TESLA',
      },
    ];

    const vehicleTypes440 = [
      {
        typeId: 2,
        typeName: 'Passenger Car',
      },
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

    nhtsaClient.getVehicleTypesXml.mockImplementation((makeId: number) => {
      if (makeId === 440) {
        return vehicleTypesXml440;
      }

      if (makeId === 441) {
        throw new Error('Vehicle types fetch failed');
      }

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

    const [, receivedMap] = ingestionTransformer.merge.mock.calls[0] as [
      TransformedMake[],
      Map<number, TransformedVehicleType[]>,
    ];

    expect(receivedMap.get(440)).toEqual(vehicleTypes440);
    expect(receivedMap.get(441)).toEqual([]);

    expect(ingestionRepository.save).toHaveBeenCalledTimes(1);

    expect(ingestionRepository.save).toHaveBeenCalledWith(finalResult);
  });

  it('should propagate the error when fetching all makes fails', async () => {
    const error = new Error('NHTSA error');

    nhtsaClient.getAllMakesXml.mockRejectedValue(error);

    await expect(service.ingest()).rejects.toThrow('NHTSA error');

    expect(xmlParser.parse).not.toHaveBeenCalled();
    expect(makeTransformer.transform).not.toHaveBeenCalled();

    expect(nhtsaClient.getVehicleTypesXml).not.toHaveBeenCalled();

    expect(ingestionTransformer.merge).not.toHaveBeenCalled();
    expect(ingestionRepository.save).not.toHaveBeenCalled();
  });

  it('should propagate repository errors', async () => {
    const makesXml = '<xml>no makes</xml>';

    const parsedMakes = {
      Response: {
        Count: 0,
        Message: 'Success',
        Results: {},
      },
    };

    nhtsaClient.getAllMakesXml.mockResolvedValue(makesXml);
    xmlParser.parse.mockReturnValue(parsedMakes);
    makeTransformer.transform.mockReturnValue([]);
    ingestionTransformer.merge.mockReturnValue([]);

    ingestionRepository.save.mockRejectedValue(new Error('Database error'));

    await expect(service.ingest()).rejects.toThrow('Database error');

    expect(ingestionRepository.save).toHaveBeenCalledWith([]);
  });

  it('should reject when save summary indicates all failures', async () => {
    const makesXml = '<xml>no makes</xml>';

    const parsedMakes = {
      Response: {
        Count: 0,
        Message: 'Success',
        Results: {},
      },
    };

    const finalResult = [
      {
        makeId: 1,
        makeName: 'TEST MAKE',
        vehicleTypes: [],
      },
      {
        makeId: 2,
        makeName: 'OTHER MAKE',
        vehicleTypes: [],
      },
    ];

    nhtsaClient.getAllMakesXml.mockResolvedValue(makesXml);
    xmlParser.parse.mockReturnValue(parsedMakes);
    makeTransformer.transform.mockReturnValue([]);
    ingestionTransformer.merge.mockReturnValue(finalResult);

    ingestionRepository.save.mockResolvedValue({
      total: 2,
      succeeded: 0,
      failed: 2,
      errors: ['Failure 1', 'Failure 2'],
    });

    await expect(service.ingest()).rejects.toThrow(
      'Ingestion failed: total=2 failed=2',
    );

    expect(ingestionRepository.save).toHaveBeenCalledWith(finalResult);
  });

  it('should return result when save summary indicates partial success', async () => {
    const makesXml = '<xml>no makes</xml>';

    const parsedMakes = {
      Response: {
        Count: 0,
        Message: 'Success',
        Results: {},
      },
    };

    const finalResult = [
      {
        makeId: 1,
        makeName: 'TEST MAKE',
        vehicleTypes: [],
      },
      {
        makeId: 2,
        makeName: 'OTHER MAKE',
        vehicleTypes: [],
      },
    ];

    nhtsaClient.getAllMakesXml.mockResolvedValue(makesXml);
    xmlParser.parse.mockReturnValue(parsedMakes);
    makeTransformer.transform.mockReturnValue([]);
    ingestionTransformer.merge.mockReturnValue(finalResult);

    ingestionRepository.save.mockResolvedValue({
      total: 2,
      succeeded: 1,
      failed: 1,
      errors: ['Failure 1'],
    });

    const result = await service.ingest();

    expect(result).toEqual(finalResult);
    expect(ingestionRepository.save).toHaveBeenCalledWith(finalResult);
  });

  it('should return result when save summary indicates no records', async () => {
    const makesXml = '<xml>no makes</xml>';

    const parsedMakes = {
      Response: {
        Count: 0,
        Message: 'Success',
        Results: {},
      },
    };

    const finalResult: any[] = [];

    nhtsaClient.getAllMakesXml.mockResolvedValue(makesXml);
    xmlParser.parse.mockReturnValue(parsedMakes);
    makeTransformer.transform.mockReturnValue([]);
    ingestionTransformer.merge.mockReturnValue(finalResult);

    ingestionRepository.save.mockResolvedValue({
      total: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    });

    const result = await service.ingest();

    expect(result).toEqual(finalResult);
    expect(ingestionRepository.save).toHaveBeenCalledWith(finalResult);
  });

  it('should limit the number of makes when maxMakes is configured', async () => {
    const limitedConfig: Record<string, number> = {
      'ingestion.concurrency': 2,
      'ingestion.batchSize': 25,
      'ingestion.requestDelayMs': 0,
      'ingestion.maxMakes': 1,
    };

    configService.getOrThrow.mockImplementation(
      (key: string): number => limitedConfig[key],
    );

    service = new IngestionService(
      nhtsaClient as never,
      xmlParser as never,
      makeTransformer as never,
      vehicleTypeTransformer as never,
      ingestionTransformer,
      ingestionRepository as never,
      configService as never,
    );

    const makesXml = '<xml>makes data</xml>';
    const vehicleTypesXml = '<xml>vehicle types for 440</xml>';

    const parsedMakes = {
      Response: {
        Count: 2,
        Message: 'Success',
        Results: {},
      },
    };

    const parsedVehicleTypes = {
      Response: {
        Count: 1,
        Message: 'Success',
        Results: {},
      },
    };

    const allMakes = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
      },
      {
        makeId: 441,
        makeName: 'TESLA',
      },
    ];

    const limitedMakes = [allMakes[0]];

    const vehicleTypes = [
      {
        typeId: 2,
        typeName: 'Passenger Car',
      },
    ];

    const finalResult = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes,
      },
    ];

    nhtsaClient.getAllMakesXml.mockResolvedValue(makesXml);

    nhtsaClient.getVehicleTypesXml.mockResolvedValue(vehicleTypesXml);

    xmlParser.parse.mockImplementation((xml: string) => {
      if (xml === makesXml) {
        return parsedMakes;
      }

      if (xml === vehicleTypesXml) {
        return parsedVehicleTypes;
      }

      throw new Error('Unexpected XML');
    });

    makeTransformer.transform.mockReturnValue(allMakes);

    vehicleTypeTransformer.transform.mockReturnValue(vehicleTypes);

    ingestionTransformer.merge.mockReturnValue(finalResult);

    const result = await service.ingest();

    expect(result).toEqual(finalResult);

    expect(nhtsaClient.getVehicleTypesXml).toHaveBeenCalledTimes(1);

    expect(nhtsaClient.getVehicleTypesXml).toHaveBeenCalledWith(440);

    expect(nhtsaClient.getVehicleTypesXml).not.toHaveBeenCalledWith(441);

    expect(ingestionTransformer.merge).toHaveBeenCalledWith(
      limitedMakes,
      expect.any(Map),
    );

    expect(ingestionRepository.save).toHaveBeenCalledWith(finalResult);
  });
});
