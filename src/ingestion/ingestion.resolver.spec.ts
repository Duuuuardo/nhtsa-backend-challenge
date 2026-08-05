import { IngestionResolver } from './ingestion.resolver';
import { IngestionService } from './services/ingestion.service';

describe('IngestionResolver', () => {
  let resolver: IngestionResolver;

  const ingestionService = {
    ingest: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    resolver = new IngestionResolver(ingestionService as never);
  });

  it('calls ingestionService.ingest without arguments and returns its result', async () => {
    const fakeResult = {
      makesProcessed: 1,
      vehicleTypeFetchFailures: 0,
      persisted: 1,
      persistenceFailures: 0,
      stoppedEarly: true,
      stopReason: 'circuitOpen',
    };

    ingestionService.ingest.mockResolvedValue(fakeResult);

    await expect(resolver.ingestNhtsaData()).resolves.toBe(fakeResult);
    expect(ingestionService.ingest).toHaveBeenCalledWith();
  });
});
