import { of, throwError } from 'rxjs';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { NhtsaClient } from './nhtsa.client';
import { CircuitOpenError, NhtsaRequestError } from '../errors';

describe('NhtsaClient', () => {
  let client: NhtsaClient;

  const httpService = {
    get: jest.fn<unknown, [string, Record<string, unknown>]>(),
  };

  const configService = {
    getOrThrow: jest.fn<string | number, [string]>((key: string) => {
      const config: Record<string, string | number> = {
        'nhtsa.allMakesUrl': 'https://example.com/all-makes',

        'nhtsa.vehicleTypesBaseUrl': 'https://example.com/makes/{makeId}/types',

        'nhtsa.requestTimeoutMs': 30000,

        'nhtsa.maxRetries': 3,

        'nhtsa.retryBaseDelayMs': 1000,

        'nhtsa.breakerFailureThreshold': 5,

        'nhtsa.breakerResetMs': 30000,
      };

      return config[key];
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    client = new NhtsaClient(httpService as never, configService as never);
  });

  it('should retrieve all makes XML', async () => {
    httpService.get.mockReturnValue(
      of({
        data: '<Response></Response>',
      }),
    );

    await expect(client.getAllMakesXml()).resolves.toBe(
      '<Response></Response>',
    );

    expect(httpService.get).toHaveBeenCalledWith(
      'https://example.com/all-makes',
      {
        responseType: 'text',
        timeout: 30000,
        headers: {
          Accept: 'application/xml,text/xml',
          'User-Agent': 'nhtsa-backend-challenge/1.0',
        },
      },
    );
  });

  it('should replace the makeId placeholder', async () => {
    httpService.get.mockReturnValue(
      of({
        data: '<Response></Response>',
      }),
    );

    await client.getVehicleTypesXml(440);

    expect(httpService.get).toHaveBeenCalledWith(
      'https://example.com/makes/440/types',
      expect.objectContaining({
        timeout: 30000,
        headers: {
          Accept: 'application/xml,text/xml',
          'User-Agent': 'nhtsa-backend-challenge/1.0',
        },
        responseType: 'text',
      }),
    );
  });

  it('should throw when the API request fails', async () => {
    const networkError: unknown = new Error('Network error');

    httpService.get.mockReturnValue(throwError(() => networkError));

    const requestPromise = client.getAllMakesXml();

    await expect(requestPromise).rejects.toBeInstanceOf(NhtsaRequestError);

    await expect(requestPromise).rejects.toMatchObject({
      status: undefined,
      attempts: expect.any(Number),
      retryable: expect.any(Boolean),
    });
  });

  it('should set status when API responds with HTTP error', async () => {
    const httpError: unknown = {
      response: { status: 500, headers: {} },
      message: 'Server error',
    };

    // Recreate client with zero retries to avoid long backoff in test
    const shortRetryConfig = {
      getOrThrow: jest.fn<string | number, [string]>((key: string) => {
        const config: Record<string, string | number> = {
          'nhtsa.allMakesUrl': 'https://example.com/all-makes',
          'nhtsa.vehicleTypesBaseUrl':
            'https://example.com/makes/{makeId}/types',
          'nhtsa.requestTimeoutMs': 30000,
          'nhtsa.maxRetries': 0,
          'nhtsa.retryBaseDelayMs': 1,
          'nhtsa.breakerFailureThreshold': 2,
          'nhtsa.breakerResetMs': 1000,
        };

        return config[key];
      }),
    };

    client = new NhtsaClient(httpService as never, shortRetryConfig as never);

    httpService.get.mockReturnValue(throwError(() => httpError));

    const requestPromise = client.getAllMakesXml();

    await expect(requestPromise).rejects.toBeInstanceOf(NhtsaRequestError);

    await expect(requestPromise).rejects.toMatchObject({
      status: expect.any(Number),
      attempts: expect.any(Number),
      retryable: expect.any(Boolean),
    });
  });

  it('should throw when the API returns an empty response', async () => {
    httpService.get.mockReturnValue(
      of({
        data: '   ',
      }),
    );

    await expect(client.getAllMakesXml()).rejects.toBeInstanceOf(
      NhtsaRequestError,
    );
  });

  it('opens the breaker after repeated failures and stops before calling HTTP again', async () => {
    const shortRetryConfig = {
      getOrThrow: jest.fn<string | number, [string]>((key: string) => {
        const config: Record<string, string | number> = {
          'nhtsa.allMakesUrl': 'https://example.com/all-makes',
          'nhtsa.vehicleTypesBaseUrl':
            'https://example.com/makes/{makeId}/types',
          'nhtsa.requestTimeoutMs': 30000,
          'nhtsa.maxRetries': 0,
          'nhtsa.retryBaseDelayMs': 1,
          'nhtsa.breakerFailureThreshold': 1,
          'nhtsa.breakerResetMs': 1000,
        };

        return config[key];
      }),
    };

    client = new NhtsaClient(httpService as never, shortRetryConfig as never);

    const networkError: unknown = {
      code: 'ECONNRESET',
      message: 'Network error',
    };

    httpService.get.mockReturnValue(throwError(() => networkError));

    await expect(client.getAllMakesXml()).rejects.toBeInstanceOf(
      NhtsaRequestError,
    );

    httpService.get.mockClear();

    await expect(client.getAllMakesXml()).rejects.toBeInstanceOf(
      CircuitOpenError,
    );

    expect(httpService.get).not.toHaveBeenCalled();
  });
});
