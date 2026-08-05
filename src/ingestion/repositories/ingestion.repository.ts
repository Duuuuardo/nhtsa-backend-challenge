import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { TransformedMakeWithVehicleTypes } from '../types/transformed.types';

@Injectable()
export class IngestionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    makes: TransformedMakeWithVehicleTypes[],
  ): Promise<void> {
    for (const make of makes) {
      await this.prisma.$transaction(async (tx) => {
        await tx.make.upsert({
          where: {
            makeId: make.makeId,
          },
          create: {
            makeId: make.makeId,
            makeName: make.makeName,
          },
          update: {
            makeName: make.makeName,
          },
        });

        await tx.vehicleType.deleteMany({
          where: {
            makeId: make.makeId,
          },
        });

        if (make.vehicleTypes.length > 0) {
          await tx.vehicleType.createMany({
            data: make.vehicleTypes.map((vehicleType) => ({
              makeId: make.makeId,
              typeId: vehicleType.typeId,
              typeName: vehicleType.typeName,
            })),
            skipDuplicates: true,
          });
        }
      });
    }
  }
}