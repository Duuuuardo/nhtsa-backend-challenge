import { IngestionRepository } from './ingestion.repository';

describe('IngestionRepository', () => {
  let repository: IngestionRepository;

  const transactionClient = {
    make: {
      upsert: jest.fn(),
    },
    vehicleType: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.$transaction.mockImplementation(
      async (
        callback: (
          tx: typeof transactionClient,
        ) => Promise<void>,
      ) => callback(transactionClient),
    );

    repository = new IngestionRepository(prisma as never);
  });

  it('should upsert a make and replace its vehicle types', async () => {
    const data = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes: [
          {
            typeId: 2,
            typeName: 'Passenger Car',
          },
          {
            typeId: 7,
            typeName: 'Multipurpose Passenger Vehicle',
          },
        ],
      },
    ];

    await repository.save(data);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    expect(transactionClient.make.upsert).toHaveBeenCalledWith({
      where: {
        makeId: 440,
      },
      create: {
        makeId: 440,
        makeName: 'ASTON MARTIN',
      },
      update: {
        makeName: 'ASTON MARTIN',
      },
    });

    expect(
      transactionClient.vehicleType.deleteMany,
    ).toHaveBeenCalledWith({
      where: {
        makeId: 440,
      },
    });

    expect(
      transactionClient.vehicleType.createMany,
    ).toHaveBeenCalledWith({
      data: [
        {
          makeId: 440,
          typeId: 2,
          typeName: 'Passenger Car',
        },
        {
          makeId: 440,
          typeId: 7,
          typeName: 'Multipurpose Passenger Vehicle',
        },
      ],
      skipDuplicates: true,
    });
  });

  it('should persist a make with no vehicle types', async () => {
    const data = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes: [],
      },
    ];

    await repository.save(data);

    expect(transactionClient.make.upsert).toHaveBeenCalledWith({
      where: {
        makeId: 440,
      },
      create: {
        makeId: 440,
        makeName: 'ASTON MARTIN',
      },
      update: {
        makeName: 'ASTON MARTIN',
      },
    });

    expect(
      transactionClient.vehicleType.deleteMany,
    ).toHaveBeenCalledWith({
      where: {
        makeId: 440,
      },
    });

    expect(
      transactionClient.vehicleType.createMany,
    ).not.toHaveBeenCalled();
  });

  it('should process multiple makes in separate transactions', async () => {
    const data = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes: [
          {
            typeId: 2,
            typeName: 'Passenger Car',
          },
        ],
      },
      {
        makeId: 441,
        makeName: 'TESLA',
        vehicleTypes: [
          {
            typeId: 3,
            typeName: 'Truck',
          },
        ],
      },
    ];

    await repository.save(data);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);

    expect(transactionClient.make.upsert).toHaveBeenNthCalledWith(
      1,
      {
        where: {
          makeId: 440,
        },
        create: {
          makeId: 440,
          makeName: 'ASTON MARTIN',
        },
        update: {
          makeName: 'ASTON MARTIN',
        },
      },
    );

    expect(transactionClient.make.upsert).toHaveBeenNthCalledWith(
      2,
      {
        where: {
          makeId: 441,
        },
        create: {
          makeId: 441,
          makeName: 'TESLA',
        },
        update: {
          makeName: 'TESLA',
        },
      },
    );
  });

  it('should propagate transaction errors', async () => {
    const error = new Error('Database transaction failed');

    prisma.$transaction.mockRejectedValue(error);

    const data = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes: [],
      },
    ];

    await expect(repository.save(data)).rejects.toThrow(
      'Database transaction failed',
    );
  });

  it('should do nothing when the input is empty', async () => {
    await repository.save([]);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transactionClient.make.upsert).not.toHaveBeenCalled();
    expect(
      transactionClient.vehicleType.deleteMany,
    ).not.toHaveBeenCalled();
    expect(
      transactionClient.vehicleType.createMany,
    ).not.toHaveBeenCalled();
  });
});