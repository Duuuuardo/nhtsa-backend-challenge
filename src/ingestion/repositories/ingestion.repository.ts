import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../database/prisma.service';
import { TransformedMakeWithVehicleTypes } from '../types/transformed.types';
import { IngestionSaveSummary } from '../types/ingestion-summary.types';

const MAX_SAVE_ERRORS = 10;

@Injectable()
export class IngestionRepository {
  private readonly logger = new Logger(IngestionRepository.name);
  private readonly batchSize: number;
  private readonly transactionTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.batchSize = this.configService.getOrThrow<number>(
      'ingestion.batchSize',
    );
    this.transactionTimeoutMs = this.configService.getOrThrow<number>(
      'ingestion.transactionTimeoutMs',
    );
  }

  async save(
    makes: TransformedMakeWithVehicleTypes[],
  ): Promise<IngestionSaveSummary> {
    const total = makes.length;
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < makes.length; i += this.batchSize) {
      const batch = makes.slice(i, i + this.batchSize);
      const makeIds = batch.map((m) => m.makeId);
      const vehicleTypesData = batch.flatMap((m) =>
        m.vehicleTypes.map((vt) => ({
          makeId: m.makeId,
          typeId: vt.typeId,
          typeName: vt.typeName,
        })),
      );

      const makeData = batch.map((m) => ({
        makeId: m.makeId,
        makeName: m.makeName,
      }));

      try {
        const operations = [
          this.prisma.make.createMany({ data: makeData, skipDuplicates: true }),
          this.prisma.vehicleType.deleteMany({
            where: { makeId: { in: makeIds } },
          }),
        ];

        if (vehicleTypesData.length > 0) {
          operations.push(
            this.prisma.vehicleType.createMany({
              data: vehicleTypesData,
              skipDuplicates: true,
            }),
          );
        }

        await this.prisma.$transaction(operations, {
          timeout: this.transactionTimeoutMs,
        });

        succeeded += batch.length;
      } catch (err) {
        failed += batch.length;
        const errorMessage = (err as Error).message;
        if (errors.length < MAX_SAVE_ERRORS) {
          errors.push(`Batch starting at index ${i} failed: ${errorMessage}`);
        }
        this.logger.error({
          message: 'Ingestion batch failed',
          batchIndex: i,
          batchLength: batch.length,
          error: errorMessage,
        });
      }
    }

    this.logger.log({
      message: 'Ingestion finished',
      total,
      succeeded,
      failed,
      errors,
    });

    return { total, succeeded, failed, errors };
  }
}
