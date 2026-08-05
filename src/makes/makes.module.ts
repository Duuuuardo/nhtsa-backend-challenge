import { Module } from '@nestjs/common';

import { PrismaModule } from '../database/prisma.module';
import { MakesResolver } from './makes.resolver';
import { MakesService } from './makes.service';

@Module({
  imports: [PrismaModule],
  providers: [MakesResolver, MakesService],
})
export class MakesModule {}
