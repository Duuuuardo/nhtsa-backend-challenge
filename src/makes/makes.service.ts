import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { Make } from './entities/make.entity';
import { MakeConnection } from './entities/make-connection.entity';

@Injectable()
export class MakesService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(makeId: number): Promise<Make | null> {
    const make = await this.prisma.make.findUnique({
      where: {
        makeId,
      },
      include: {
        vehicleTypes: {
          include: {
            vehicleType: true,
          },
        },
      },
    });

    if (!make) {
      return null;
    }

    return {
      ...make,
      vehicleTypes: make.vehicleTypes.map((link) => link.vehicleType),
    };
  }

  async findAllPaginated(
    first: number,
    after?: string,
  ): Promise<MakeConnection> {
    const limit = Math.max(1, Math.min(first ?? 25, 100));

    let afterMakeId: number | undefined;
    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf8');
      const parsed = Number(decoded);
      if (!Number.isNaN(parsed)) {
        afterMakeId = parsed;
      }
    }

    const [items, totalCount] = await this.prisma.$transaction([
      this.prisma.make.findMany({
        take: limit + 1,
        ...(afterMakeId !== undefined && {
          cursor: { makeId: afterMakeId },
          skip: 1,
        }),
        orderBy: { makeId: 'asc' },
        include: { vehicleTypes: { include: { vehicleType: true } } },
      }),
      this.prisma.make.count(),
    ]);

    const hasNextPage = items.length > limit;
    const nodes = hasNextPage ? items.slice(0, limit) : items;

    const edges = nodes.map((make) => ({
      cursor: Buffer.from(String(make.makeId)).toString('base64'),
      node: {
        makeId: make.makeId,
        makeName: make.makeName,
        vehicleTypes: make.vehicleTypes.map((link) => link.vehicleType),
      },
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
      },
      totalCount,
    };
  }
}
