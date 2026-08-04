import { Field, Int, ObjectType } from '@nestjs/graphql';

import { VehicleType } from './vehicle-type.entity';

@ObjectType({
  description: 'A vehicle manufacturer retrieved from NHTSA.',
})
export class Make {
  @Field(() => Int, {
    description: 'Manufacturer identifier provided by NHTSA.',
  })
  makeId: number;

  @Field(() => String, {
    description: 'Manufacturer name.',
  })
  makeName: string;

  @Field(() => [VehicleType], {
    description: 'Vehicle types produced by this manufacturer.',
  })
  vehicleTypes: VehicleType[];
}
