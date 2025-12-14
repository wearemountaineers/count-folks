import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountsService } from './counts.service';
import { CountsController } from './counts.controller';
import { Count } from './entities/count.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Count])],
  controllers: [CountsController],
  providers: [CountsService],
  exports: [CountsService],
})
export class CountsModule {}


