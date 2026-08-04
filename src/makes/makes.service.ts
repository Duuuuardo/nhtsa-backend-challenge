import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { Make } from './entities/make.entity';

@Injectable()
export class MakesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Make[]> {
    return this.prisma.make.findMany({
      include: {
        vehicleTypes: true,
      },
      orderBy: {
        makeName: 'asc',
      },
    });
  }

  async findOne(makeId: number): Promise<Make | null> {
    return this.prisma.make.findUnique({
      where: {
        makeId,
      },
      include: {
        vehicleTypes: true,
      },
    });
  }
}
