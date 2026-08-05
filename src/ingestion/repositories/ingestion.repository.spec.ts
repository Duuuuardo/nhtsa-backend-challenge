import { IngestionSaveSummary } from '../types/ingestion-summary.types';
import { IngestionRepository } from './ingestion.repository';

describe('IngestionRepository', () => {
  let repository: IngestionRepository;
  const batchSize = 2;
  const timeoutMs = 123;

  const prisma = {
    $transaction: jest.fn(),
    make: {
      createMany: jest.fn().mockReturnValue('op:createMany-makes'),
    },
    vehicleType: {
      upsert: jest.fn().mockReturnValue('op:upsert-vehicleType'),
    },
    makeVehicleType: {
      deleteMany: jest.fn().mockReturnValue('op:deleteMany-makeVehicleType'),
      createMany: jest.fn().mockReturnValue('op:createMany-makeVehicleType'),
    },
  };

  const config = {
    getOrThrow: jest.fn(),
  };

  const buildMake = (id: number) => ({
    makeId: id,
    makeName: `MAKE-${id}`,
    vehicleTypes: [{ typeId: 100 + id, typeName: `Type-${id}` }],
  });

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.$transaction.mockResolvedValue(undefined);

    config.getOrThrow.mockImplementation((key: string) => {
      if (key === 'ingestion.batchSize') return batchSize;
      if (key === 'ingestion.transactionTimeoutMs') return timeoutMs;
      throw new Error(`Unexpected config key: ${key}`);
    });

    repository = new IngestionRepository(prisma as never, config as never);
  });

  it('should batch 5 makes into 3 transactions', async () => {
    const data = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes: [{ typeId: 2, typeName: 'Passenger Car' }],
      },
      {
        makeId: 441,
        makeName: 'TESLA',
        vehicleTypes: [{ typeId: 3, typeName: 'Truck' }],
      },
      {
        makeId: 442,
        makeName: 'FORD',
        vehicleTypes: [{ typeId: 4, typeName: 'SUV' }],
      },
      {
        makeId: 443,
        makeName: 'HONDA',
        vehicleTypes: [{ typeId: 5, typeName: 'Motorcycle' }],
      },
      {
        makeId: 444,
        makeName: 'TOYOTA',
        vehicleTypes: [{ typeId: 6, typeName: 'Pickup' }],
      },
    ];

    await repository.save(data);

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(prisma.make.createMany).toHaveBeenCalledTimes(3);
    expect(prisma.makeVehicleType.deleteMany).toHaveBeenCalledTimes(3);
    expect(prisma.vehicleType.upsert).toHaveBeenCalledTimes(5);
    expect(prisma.makeVehicleType.createMany).toHaveBeenCalledTimes(3);

    expect(prisma.$transaction).toHaveBeenNthCalledWith(
      1,
      [
        'op:createMany-makes',
        'op:deleteMany-makeVehicleType',
        'op:upsert-vehicleType',
        'op:upsert-vehicleType',
        'op:createMany-makeVehicleType',
      ],
      { timeout: timeoutMs },
    );
  });

  it('should assemble operations in the correct order when vehicle types exist', async () => {
    const data = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes: [
          { typeId: 2, typeName: 'Passenger Car' },
          { typeId: 7, typeName: 'Multipurpose Passenger Vehicle' },
        ],
      },
    ];

    await repository.save(data);

    expect(prisma.make.createMany).toHaveBeenCalledWith({
      data: [{ makeId: 440, makeName: 'ASTON MARTIN' }],
      skipDuplicates: true,
    });

    expect(prisma.makeVehicleType.deleteMany).toHaveBeenCalledWith({
      where: {
        makeId: {
          in: [440],
        },
      },
    });

    expect(prisma.vehicleType.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.vehicleType.upsert).toHaveBeenNthCalledWith(1, {
      where: { typeId: 2 },
      update: { typeName: 'Passenger Car' },
      create: { typeId: 2, typeName: 'Passenger Car' },
    });
    expect(prisma.vehicleType.upsert).toHaveBeenNthCalledWith(2, {
      where: { typeId: 7 },
      update: { typeName: 'Multipurpose Passenger Vehicle' },
      create: {
        typeId: 7,
        typeName: 'Multipurpose Passenger Vehicle',
      },
    });

    expect(prisma.makeVehicleType.createMany).toHaveBeenCalledWith({
      data: [
        { makeId: 440, typeId: 2 },
        { makeId: 440, typeId: 7 },
      ],
      skipDuplicates: true,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const transactionCalls = prisma.$transaction.mock.calls as unknown[][];
    expect(transactionCalls[0][0]).toEqual([
      'op:createMany-makes',
      'op:deleteMany-makeVehicleType',
      'op:upsert-vehicleType',
      'op:upsert-vehicleType',
      'op:createMany-makeVehicleType',
    ]);
  });

  it('should still delete types when a make has no vehicle types', async () => {
    const data = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes: [],
      },
    ];

    await repository.save(data);

    expect(prisma.make.createMany).toHaveBeenCalledWith({
      data: [{ makeId: 440, makeName: 'ASTON MARTIN' }],
      skipDuplicates: true,
    });

    expect(prisma.makeVehicleType.deleteMany).toHaveBeenCalledWith({
      where: {
        makeId: {
          in: [440],
        },
      },
    });

    expect(prisma.vehicleType.upsert).not.toHaveBeenCalled();
    expect(prisma.makeVehicleType.createMany).not.toHaveBeenCalled();

    const transactionCalls = prisma.$transaction.mock.calls as unknown[][];
    expect(transactionCalls[0][0]).toEqual([
      'op:createMany-makes',
      'op:deleteMany-makeVehicleType',
    ]);
  });

  it('should pass timeout from config to each transaction', async () => {
    const data = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes: [{ typeId: 2, typeName: 'Passenger Car' }],
      },
      {
        makeId: 441,
        makeName: 'TESLA',
        vehicleTypes: [{ typeId: 3, typeName: 'Truck' }],
      },
    ];

    await repository.save(data);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array), {
      timeout: timeoutMs,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should return zero summary for empty data', async () => {
    await expect(repository.save([])).resolves.toEqual({
      total: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should not propagate transaction failure and count batch failures atomically', async () => {
    const data = [buildMake(440), buildMake(441), buildMake(442)];
    prisma.$transaction.mockRejectedValueOnce(new Error('db down'));

    const summary: IngestionSaveSummary = await repository.save(data);

    expect(summary).toMatchObject({
      total: 3,
      succeeded: 1,
      failed: 2,
    });
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toContain('index 0');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('should return a success summary when all batches succeed', async () => {
    const data = [buildMake(440), buildMake(441)];

    const summary = await repository.save(data);

    expect(summary).toEqual({
      total: 2,
      succeeded: 2,
      failed: 0,
      errors: [],
    });
  });

  it('should cap stored errors while counting all failed records', async () => {
    const data = Array.from({ length: 24 }, (_, index) =>
      buildMake(440 + index),
    );
    prisma.$transaction.mockRejectedValue(new Error('db down'));

    const summary = await repository.save(data);

    expect(prisma.$transaction).toHaveBeenCalledTimes(12);
    expect(summary.total).toBe(24);
    expect(summary.succeeded).toBe(0);
    expect(summary.failed).toBe(24);
    expect(summary.errors).toHaveLength(10);
  });
});
