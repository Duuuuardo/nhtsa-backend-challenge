import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({
  description: 'Pagination information for cursor-based lists.',
})
export class PageInfo {
  @Field(() => Boolean, {
    description: 'Indicates if there is a next page available.',
  })
  hasNextPage: boolean;

  @Field(() => String, {
    description: 'Cursor pointing to the end of the current page.',
    nullable: true,
  })
  endCursor: string | null;
}
