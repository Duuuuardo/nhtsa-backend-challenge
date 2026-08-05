import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Prisma } from '../../generated/prisma/client';
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

      const uniqueVehicleTypes = Array.from(
        new Map(
          vehicleTypesData.map((vt) => [
            vt.typeId,
            { typeId: vt.typeId, typeName: vt.typeName },
          ]),
        ).values(),
      );

      const existingVehicleTypes = await this.prisma.vehicleType.findMany({
        where: { typeId: { in: uniqueVehicleTypes.map((vt) => vt.typeId) } },
        select: { typeId: true, typeName: true },
      });

      const existingTypeNames = new Map(
        existingVehicleTypes.map((vt) => [vt.typeId, vt.typeName]),
      );

      for (const vehicleType of uniqueVehicleTypes) {
        const existingTypeName = existingTypeNames.get(vehicleType.typeId);
        if (
          existingTypeName !== undefined &&
          existingTypeName !== vehicleType.typeName
        ) {
          this.logger.warn({
            event: 'ingestion.vehicleType.conflict',
            typeId: vehicleType.typeId,
            existingTypeName,
            incomingTypeName: vehicleType.typeName,
          });
        }
      }

      const makeVehicleTypeData = batch.flatMap((m) =>
        m.vehicleTypes.map((vt) => ({
          makeId: m.makeId,
          typeId: vt.typeId,
        })),
      );

      const makeData = batch.map((m) => ({
        makeId: m.makeId,
        makeName: m.makeName,
      }));

      try {
        const operations: Prisma.PrismaPromise<unknown>[] = [
          this.prisma.make.createMany({ data: makeData, skipDuplicates: true }),
          this.prisma.makeVehicleType.deleteMany({
            where: { makeId: { in: makeIds } },
          }),
        ];

        for (const vehicleType of uniqueVehicleTypes) {
          operations.push(
            this.prisma.vehicleType.upsert({
              where: { typeId: vehicleType.typeId },
              update: { typeName: vehicleType.typeName },
              create: {
                typeId: vehicleType.typeId,
                typeName: vehicleType.typeName,
              },
            }),
          );
        }

        if (makeVehicleTypeData.length > 0) {
          operations.push(
            this.prisma.makeVehicleType.createMany({
              data: makeVehicleTypeData,
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
