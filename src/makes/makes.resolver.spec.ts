import { MakesResolver } from './makes.resolver';

describe('MakesResolver', () => {
  let resolver: MakesResolver;

  const makesService = {
    findAllPaginated: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    resolver = new MakesResolver(makesService as never);
  });

  it('calls makesService.findAll and returns its result', async () => {
    const result = [
      { makeId: 440, makeName: 'ASTON MARTIN', vehicleTypes: [] },
    ];

    makesService.findAllPaginated.mockResolvedValue(result as any);

    await expect(resolver.findAll(25)).resolves.toBe(result);
    expect(makesService.findAllPaginated).toHaveBeenCalledTimes(1);
  });

  it('calls makesService.findOne with the supplied makeId', async () => {
    const result = { makeId: 440, makeName: 'ASTON MARTIN', vehicleTypes: [] };

    makesService.findOne.mockResolvedValue(result);

    await expect(resolver.findOne(440)).resolves.toBe(result);
    expect(makesService.findOne).toHaveBeenCalledWith(440);
  });
});
