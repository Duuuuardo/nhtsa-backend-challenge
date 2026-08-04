import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NhtsaClient {
  private readonly logger = new Logger(NhtsaClient.name);

  private readonly allMakesUrl: string;
  private readonly vehicleTypesUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.allMakesUrl =
      this.configService.getOrThrow<string>('nhtsa.allMakesUrl');

    this.vehicleTypesUrl = this.configService.getOrThrow<string>(
      'nhtsa.vehicleTypesBaseUrl',
    );
  }

  async getAllMakesXml(): Promise<string> {
    return this.getXml(this.allMakesUrl, 'all makes');
  }

  async getVehicleTypesXml(makeId: number): Promise<string> {
    const url = this.vehicleTypesUrl.replace('{makeId}', String(makeId));

    return this.getXml(url, `vehicle types for make ${makeId}`);
  }

  private async getXml(url: string, operation: string): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<string>(url, {
          responseType: 'text',
          timeout: 10_000,
          headers: {
            Accept: 'application/xml,text/xml',
          },
        }),
      );

      if (!response.data?.trim()) {
        throw new BadGatewayException(
          `NHTSA returned an empty response for ${operation}`,
        );
      }

      return response.data;
    } catch (error: unknown) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      const axiosError = error as AxiosError;

      this.logger.error({
        message: 'NHTSA request failed',
        operation,
        url,
        status: axiosError.response?.status,
        error: axiosError.message,
      });

      throw new BadGatewayException(
        `Failed to retrieve ${operation} from NHTSA`,
      );
    }
  }
}
