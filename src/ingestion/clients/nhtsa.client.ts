import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { NhtsaRequestError } from '../errors';

@Injectable()
export class NhtsaClient {
  private readonly logger = new Logger(NhtsaClient.name);

  private readonly allMakesUrl: string;
  private readonly vehicleTypesUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.allMakesUrl =
      this.configService.getOrThrow<string>('nhtsa.allMakesUrl');

    this.vehicleTypesUrl = this.configService.getOrThrow<string>(
      'nhtsa.vehicleTypesBaseUrl',
    );

    this.requestTimeoutMs = this.configService.getOrThrow<number>(
      'nhtsa.requestTimeoutMs',
    );

    this.maxRetries = this.configService.getOrThrow<number>('nhtsa.maxRetries');

    this.retryBaseDelayMs = this.configService.getOrThrow<number>(
      'nhtsa.retryBaseDelayMs',
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
    const attemptFetch = async () => {
      const response = await firstValueFrom(
        this.httpService.get<string>(url, {
          responseType: 'text',
          timeout: this.requestTimeoutMs,
          headers: {
            Accept: 'application/xml,text/xml',
            'User-Agent': 'nhtsa-backend-challenge/1.0',
          },
        }),
      );

      if (!response.data?.trim()) {
        throw new NhtsaRequestError({
          operation,
          url,
          attempts: 0,
          retryable: false,
          message: `NHTSA returned an empty response for ${operation}`,
        });
      }

      return response.data;
    };

    return this.withRetry<string>(attemptFetch, { url, operation });
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    context: { url: string; operation: string },
  ): Promise<T> {
    const transientCodes = new Set([
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ECONNABORTED',
    ]);

    const shouldRetry = (
      err: unknown,
    ): { ok: boolean; delayMs?: number; status?: number } => {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;

      if (axiosErr.code && transientCodes.has(axiosErr.code)) {
        return { ok: true };
      }

      if (status) {
        if (status === 429) {
          const headers = axiosErr.response?.headers as
            Record<string, string | undefined> | undefined;
          const retryAfter = headers?.['retry-after'];
          if (retryAfter) {
            const seconds = Number(retryAfter);
            if (!Number.isNaN(seconds))
              return { ok: true, delayMs: seconds * 1000, status };
          }
          return { ok: true, status };
        }

        if (status >= 500 && status < 600) return { ok: true, status };

        return { ok: false, status };
      }

      return { ok: false };
    };

    let attempt = 0;
    const max = this.maxRetries;

    while (true) {
      try {
        if (attempt > 0) {
          this.logger.warn({
            message: 'Retry attempt',
            attempt,
            maxRetries: max,
            url: context.url,
            operation: context.operation,
          });
        }

        return await fn();
      } catch (err: unknown) {
        const decision = shouldRetry(err);

        if (!decision.ok || attempt >= max) {
          this.logger.error({
            message: 'NHTSA request failed (exhausted retries)',
            attempt,
            maxRetries: max,
            url: context.url,
            operation: context.operation,
            status: decision.status,
            error: (err as AxiosError).message,
          });

          throw new NhtsaRequestError({
            operation: context.operation,
            url: context.url,
            attempts: attempt + 1,
            retryable: false,
            status: decision.status,
            message: `Failed to retrieve ${context.operation} from NHTSA`,
            cause: err,
          });
        }

        const base = this.retryBaseDelayMs * 2 ** attempt;
        const jitterFactor = 0.5 + Math.random();
        const computed = Math.round(base * jitterFactor);
        const delayMs = decision.delayMs ?? computed;

        this.logger.warn({
          message: 'Retrying NHTSA request',
          attempt: attempt + 1,
          maxRetries: max,
          status: decision.status,
          delayMs,
          url: context.url,
        });

        await new Promise((res) => setTimeout(res, delayMs));
        attempt += 1;
      }
    }
  }
}
