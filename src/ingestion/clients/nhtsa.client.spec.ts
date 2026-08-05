import { BadGatewayException } from '@nestjs/common';
import { of, throwError } from 'rxjs';

import { NhtsaClient } from './nhtsa.client';

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

    await expect(client.getAllMakesXml()).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('should throw when the API returns an empty response', async () => {
    httpService.get.mockReturnValue(
      of({
        data: '   ',
      }),
    );

    await expect(client.getAllMakesXml()).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
