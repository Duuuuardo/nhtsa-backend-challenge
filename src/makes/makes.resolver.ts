import { Args, Int, Query, Resolver } from '@nestjs/graphql';

import { Make } from './entities/make.entity';
import { MakesService } from './makes.service';

@Resolver(() => Make)
export class MakesResolver {
  constructor(private readonly makesService: MakesService) {}

  @Query(() => [Make], {
    name: 'makes',
    description: 'Returns all stored vehicle manufacturers.',
  })
  findAll(): Promise<Make[]> {
    return this.makesService.findAll();
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
