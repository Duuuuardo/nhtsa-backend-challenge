import { Args, Int, Query, Resolver } from '@nestjs/graphql';

import { Make } from './entities/make.entity';
import { MakeConnection } from './entities/make-connection.entity';
import { MakesService } from './makes.service';

@Resolver(() => Make)
export class MakesResolver {
  constructor(private readonly makesService: MakesService) {}

  @Query(() => MakeConnection, {
    name: 'makes',
    description: 'Returns manufacturers with cursor-based pagination.',
  })
  findAll(
    @Args('first', { type: () => Int, defaultValue: 25 }) first: number,
    @Args('after', { type: () => String, nullable: true }) after?: string,
  ): Promise<MakeConnection> {
    return this.makesService.findAllPaginated(first, after);
  }

  @Query(() => Make, {
    name: 'make',
    nullable: true,
    description: 'Returns a manufacturer by its NHTSA identifier.',
  })
  findOne(
    @Args('makeId', { type: () => Int })
    makeId: number,
  ): Promise<Make | null> {
    return this.makesService.findOne(makeId);
  }
}
