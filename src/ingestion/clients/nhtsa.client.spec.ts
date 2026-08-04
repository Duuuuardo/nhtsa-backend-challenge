import { HttpService } from '@nestjs/axios';
import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';

import { NhtsaClient } from './nhtsa.client';

describe('NhtsaClient', () => {
  let client: NhtsaClient;

  const httpService = {
    get: jest.fn(),
  };

  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const config = {
        'nhtsa.allMakesUrl': 'https://example.com/all-makes',
        'nhtsa.vehicleTypesBaseUrl': 'https://example.com/makes/{makeId}/types',
      };

      return config[key];
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    client = new NhtsaClient(
      httpService as unknown as HttpService,
      configService as unknown as ConfigService,
    );
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
      expect.objectContaining({
        responseType: 'text',
      }),
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
      expect.any(Object),
    );
  });

  it('should throw when the API request fails', async () => {
    httpService.get.mockReturnValue(
      throwError(() => new Error('Network error')),
    );

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
