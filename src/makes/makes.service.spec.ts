import { MakesService } from './makes.service';

describe('MakesService', () => {
  let service: MakesService;

  const prisma = {
    make: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new MakesService(prisma as never);
  });

  it('calls prisma.make.findUnique with where makeId and include nested vehicleType', async () => {
    prisma.make.findUnique.mockResolvedValue(null);

    await service.findOne(440);

    expect(prisma.make.findUnique).toHaveBeenCalledWith({
      where: { makeId: 440 },
      include: {
        vehicleTypes: {
          include: { vehicleType: true },
        },
      },
    });
  });

  it('returns flattened vehicleTypes when prisma.make.findUnique returns a make', async () => {
    const result = {
      makeId: 440,
      makeName: 'ASTON MARTIN',
      vehicleTypes: [
        {
          makeId: 440,
          typeId: 2,
          createdAt: new Date(),
          vehicleType: { typeId: 2, typeName: 'Passenger Car' },
        },
      ],
    };

    prisma.make.findUnique.mockResolvedValue(result);

    await expect(service.findOne(440)).resolves.toEqual({
      makeId: 440,
      makeName: 'ASTON MARTIN',
      vehicleTypes: [{ typeId: 2, typeName: 'Passenger Car' }],
    });
  });

  it('returns null when prisma.make.findUnique returns null', async () => {
    prisma.make.findUnique.mockResolvedValue(null);

    await expect(service.findOne(440)).resolves.toBeNull();
  });

  it('findAllPaginated returns edges, pageInfo and totalCount (hasNextPage true)', async () => {
    const items = [
      { makeId: 1, makeName: 'A', vehicleTypes: [] },
      { makeId: 2, makeName: 'B', vehicleTypes: [] },
      { makeId: 3, makeName: 'C', vehicleTypes: [] },
    ];

    prisma.$transaction.mockResolvedValue([items, 3]);

    const res = await service.findAllPaginated(2);

    expect(prisma.make.findMany).toHaveBeenCalled();
    expect(res.totalCount).toBe(3);
    expect(res.edges).toHaveLength(2);
    expect(res.pageInfo.hasNextPage).toBe(true);
    expect(res.pageInfo.endCursor).toBeDefined();
  });

  it('throws when pagination cursor is invalid', async () => {
    await expect(
      service.findAllPaginated(2, 'not-a-valid-cursor'),
    ).rejects.toThrow('Invalid pagination cursor.');
  });

  it('throws when pagination cursor points to a missing make', async () => {
    prisma.make.findUnique.mockResolvedValue(null);

    await expect(
      service.findAllPaginated(2, Buffer.from('999').toString('base64')),
    ).rejects.toThrow('Invalid pagination cursor.');
  });
});
