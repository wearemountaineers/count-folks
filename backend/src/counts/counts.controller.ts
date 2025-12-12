import { Controller, Get, Post, Body, Query, ValidationPipe } from '@nestjs/common';
import { CountsService } from './counts.service';
import { CreateCountDto } from './dto/create-count.dto';

@Controller('counts')
export class CountsController {
  constructor(private readonly countsService: CountsService) {}

  @Post()
  create(@Body(ValidationPipe) createCountDto: CreateCountDto) {
    return this.countsService.create(createCountDto);
  }

  @Get()
  findAll(
    @Query('streamId') streamId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('aggregation') aggregation?: string,
  ) {
    return this.countsService.findAll(streamId, from, to, aggregation);
  }

  @Get('busyness')
  getBusyness(
    @Query('streamId') streamId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('bucketSize') bucketSize?: string,
  ) {
    return this.countsService.getBusyness(streamId, from, to, bucketSize || '5min');
  }

  @Get('busyness/compare')
  getBusynessWithComparison(
    @Query('streamId') streamId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('bucketSize') bucketSize?: string,
    @Query('compareDays') compareDays?: string,
  ) {
    const days = compareDays ? parseInt(compareDays, 10) : 7;
    return this.countsService.getBusynessWithComparison(
      streamId,
      from,
      to,
      bucketSize || '5min',
      days,
    );
  }
}

