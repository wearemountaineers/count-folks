import { IsString, IsNumber, IsDateString, Min } from 'class-validator';

export class CreateCountDto {
  @IsString()
  streamId: string;

  @IsDateString()
  windowStart: string;

  @IsDateString()
  windowEnd: string;

  @IsNumber()
  @Min(0)
  avgCount: number;
}

