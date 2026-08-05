import { Field, ObjectType } from '@nestjs/graphql';

import { Make } from './make.entity';

@ObjectType({
  description: 'An edge in a connection for manufacturers.',
})
export class MakeEdge {
  @Field(() => String, {
    description: 'Opaque cursor for this edge.',
  })
  cursor: string;

  @Field(() => Make, {
    description: 'The manufacturer node for this edge.',
  })
  node: Make;
}
