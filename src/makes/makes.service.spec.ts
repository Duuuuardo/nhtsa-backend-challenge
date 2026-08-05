import { MakesService } from './makes.service';

describe('MakesService', () => {
  let service: MakesService;

  const prisma = {
    make: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new MakesService(prisma as never);
  });

  it('calls prisma.make.findMany with include vehicleTypes and orderBy makeName asc', async () => {
    prisma.make.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(prisma.make.findMany).toHaveBeenCalledWith({
      include: { vehicleTypes: true },
      orderBy: { makeName: 'asc' },
    });
  });

  it('returns the array returned by prisma.make.findMany', async () => {
    const result = [
      { makeId: 440, makeName: 'ASTON MARTIN', vehicleTypes: [] },
    ];

    prisma.make.findMany.mockResolvedValue(result);

    await expect(service.findAll()).resolves.toBe(result);
  });

  it('calls prisma.make.findUnique with where makeId and include vehicleTypes', async () => {
    prisma.make.findUnique.mockResolvedValue(null);

    await service.findOne(440);

    expect(prisma.make.findUnique).toHaveBeenCalledWith({
      where: { makeId: 440 },
      include: { vehicleTypes: true },
    });
  });

  it('returns null when prisma.make.findUnique returns null', async () => {
    prisma.make.findUnique.mockResolvedValue(null);

    await expect(service.findOne(440)).resolves.toBeNull();
  });
});
