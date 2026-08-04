import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({
  description: 'A vehicle category associated with a manufacturer.',
})
export class VehicleType {
  @Field(() => Int, {
    description: 'Vehicle type identifier provided by NHTSA.',
  })
  typeId: number;

  @Field(() => String, {
    description: 'Human-readable vehicle type name.',
  })
  typeName: string;
}
