import { Field, Int, ObjectType } from '@nestjs/graphql';

import { MakeEdge } from './make-edge.entity';
import { PageInfo } from './page-info.entity';

@ObjectType({
  description: 'A paginated connection of manufacturers.',
})
export class MakeConnection {
  @Field(() => [MakeEdge], {
    description: 'Edges for the current page of manufacturers.',
  })
  edges: MakeEdge[];

  @Field(() => PageInfo, {
    description: 'Pagination information for the connection.',
  })
  pageInfo: PageInfo;

  @Field(() => Int, {
    description: 'Total number of manufacturers available.',
  })
  totalCount: number;
}
