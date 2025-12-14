import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Count } from './entities/count.entity';
import { CreateCountDto } from './dto/create-count.dto';

@Injectable()
export class CountsService {
  constructor(
    @InjectRepository(Count)
    private countsRepository: Repository<Count>,
  ) {}

  async create(createCountDto: CreateCountDto): Promise<Count> {
    const count = this.countsRepository.create({
      streamId: createCountDto.streamId,
      windowStart: new Date(createCountDto.windowStart),
      windowEnd: new Date(createCountDto.windowEnd),
      avgCount: createCountDto.avgCount,
    });
    return this.countsRepository.save(count);
  }

  async findAll(
    streamId?: string,
    from?: string,
    to?: string,
    aggregation?: string,
  ): Promise<Count[] | any[]> {
    const queryBuilder = this.countsRepository.createQueryBuilder('count');

    // Filter by streamId if provided
    if (streamId) {
      queryBuilder.where('count.streamId = :streamId', { streamId });
    }

    // Filter by date range
    if (from && to) {
      queryBuilder.andWhere('count.windowStart >= :from', { from: new Date(from) });
      queryBuilder.andWhere('count.windowEnd <= :to', { to: new Date(to) });
    } else if (from) {
      queryBuilder.andWhere('count.windowStart >= :from', { from: new Date(from) });
    } else if (to) {
      queryBuilder.andWhere('count.windowEnd <= :to', { to: new Date(to) });
    }

    // Order by window start
    queryBuilder.orderBy('count.windowStart', 'ASC');

    const counts = await queryBuilder.getMany();

    // Apply aggregation if requested
    if (aggregation === 'hour' || aggregation === 'day') {
      return this.aggregateCounts(counts, aggregation);
    }

    return counts;
  }

  private aggregateCounts(counts: Count[], aggregation: string): any[] {
    const grouped = new Map<string, { sum: number; count: number; windowStart: Date; windowEnd: Date }>();

    for (const count of counts) {
      let key: string;
      let windowStart: Date;
      let windowEnd: Date;

      if (aggregation === 'hour') {
        // Group by hour
        windowStart = new Date(count.windowStart);
        windowStart.setMinutes(0, 0, 0);
        windowEnd = new Date(windowStart);
        windowEnd.setHours(windowEnd.getHours() + 1);
        key = `${count.streamId}_${windowStart.toISOString()}`;
      } else {
        // Group by day
        windowStart = new Date(count.windowStart);
        windowStart.setHours(0, 0, 0, 0);
        windowEnd = new Date(windowStart);
        windowEnd.setDate(windowEnd.getDate() + 1);
        key = `${count.streamId}_${windowStart.toISOString()}`;
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          sum: 0,
          count: 0,
          windowStart,
          windowEnd,
        });
      }

      const group = grouped.get(key);
      group.sum += count.avgCount;
      group.count += 1;
    }

    // Convert to array and calculate averages
    return Array.from(grouped.entries()).map(([key, data]) => ({
      streamId: key.split('_')[0],
      windowStart: data.windowStart,
      windowEnd: data.windowEnd,
      avgCount: data.sum / data.count,
      count: data.count,
    }));
  }

  async getBusyness(
    streamId?: string,
    from?: string,
    to?: string,
    bucketSize: string = '5min',
  ): Promise<any[]> {
    // First get all counts
    const counts = await this.findAll(streamId, from, to);
    
    if (counts.length === 0) {
      return [];
    }

    // Parse bucket size
    const bucketSeconds = this.parseBucketSize(bucketSize);
    
    // Group counts into buckets and take maximum per bucket
    const buckets = new Map<string, { max: number; windowStart: Date; windowEnd: Date; count: number }>();
    
    for (const count of counts) {
      const countDate = new Date(count.windowStart);
      const bucketStart = this.getBucketStart(countDate, bucketSeconds);
      const bucketEnd = new Date(bucketStart.getTime() + bucketSeconds * 1000);
      const bucketKey = bucketStart.toISOString();
      
      const avgCount = typeof count.avgCount === 'string' 
        ? parseFloat(count.avgCount) 
        : count.avgCount;
      
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, {
          max: avgCount,
          windowStart: bucketStart,
          windowEnd: bucketEnd,
          count: 1,
        });
      } else {
        const bucket = buckets.get(bucketKey);
        bucket.max = Math.max(bucket.max, avgCount);
        bucket.count += 1;
      }
    }
    
    // Convert to array and calculate busyness level
    return Array.from(buckets.entries())
      .map(([key, data]) => ({
        windowStart: data.windowStart,
        windowEnd: data.windowEnd,
        maxCount: data.max,
        busynessLevel: this.calculateBusynessLevel(data.max),
        dataPoints: data.count,
      }))
      .sort((a, b) => a.windowStart.getTime() - b.windowStart.getTime());
  }

  private parseBucketSize(bucketSize: string): number {
    const match = bucketSize.match(/^(\d+)(min|hour|sec)$/);
    if (!match) {
      return 300; // Default 5 minutes
    }
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'sec':
        return value;
      case 'min':
        return value * 60;
      case 'hour':
        return value * 3600;
      default:
        return 300;
    }
  }

  private getBucketStart(date: Date, bucketSeconds: number): Date {
    const timestamp = date.getTime();
    const bucketStart = Math.floor(timestamp / (bucketSeconds * 1000)) * (bucketSeconds * 1000);
    return new Date(bucketStart);
  }

  async getBusynessWithComparison(
    streamId?: string,
    from?: string,
    to?: string,
    bucketSize: string = '5min',
    compareDays: number = 7,
  ): Promise<any[]> {
    // Get current busyness data
    const currentBusyness = await this.getBusyness(streamId, from, to, bucketSize);
    
    if (currentBusyness.length === 0) {
      return [];
    }

    const bucketSeconds = this.parseBucketSize(bucketSize);
    const result = [];

    for (const current of currentBusyness) {
      // Calculate historical comparison for this time window
      const historicalData = await this.getHistoricalDataForTimeWindow(
        streamId,
        current.windowStart,
        bucketSeconds,
        compareDays,
      );

      const historicalAvg = historicalData.average;
      const historicalMax = historicalData.max;
      const currentCount = current.maxCount;
      
      // Calculate percentage change
      let percentageChange = 0;
      if (historicalAvg > 0) {
        percentageChange = ((currentCount - historicalAvg) / historicalAvg) * 100;
      } else if (currentCount > 0) {
        percentageChange = 100; // No historical data but current has data
      }

      // Calculate relative indicator
      const relativeIndicator = this.calculateRelativeIndicator(percentageChange);

      result.push({
        ...current,
        historicalAverage: historicalAvg,
        historicalMax: historicalMax,
        historicalDataPoints: historicalData.count,
        percentageChange: Math.round(percentageChange * 10) / 10, // Round to 1 decimal
        relativeIndicator,
        comparisonDays: compareDays,
      });
    }

    return result;
  }

  private async getHistoricalDataForTimeWindow(
    streamId: string | undefined,
    currentWindowStart: Date,
    bucketSeconds: number,
    compareDays: number,
  ): Promise<{ average: number; max: number; count: number }> {
    // Extract time of day components
    const currentDate = new Date(currentWindowStart);
    const hour = currentDate.getUTCHours();
    const minute = currentDate.getUTCMinutes();
    
    // Calculate the bucket start time (e.g., if current is 14:07 and bucket is 15min, bucket starts at 14:00)
    const bucketMinutes = Math.floor(bucketSeconds / 60);
    const bucketStartMinute = Math.floor(minute / bucketMinutes) * bucketMinutes;
    
    // Calculate date range for historical data (exclude today)
    const endDate = new Date(currentDate);
    endDate.setUTCDate(endDate.getUTCDate() - 1);
    endDate.setUTCHours(23, 59, 59, 999);
    
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - compareDays + 1);
    startDate.setUTCHours(0, 0, 0, 0);

    // Query all counts in the historical range
    const queryBuilder = this.countsRepository.createQueryBuilder('count');
    
    if (streamId) {
      queryBuilder.where('count.streamId = :streamId', { streamId });
    }

    queryBuilder
      .andWhere('count.windowStart >= :startDate', { startDate })
      .andWhere('count.windowStart <= :endDate', { endDate })
      .orderBy('count.windowStart', 'ASC');

    const historicalCounts = await queryBuilder.getMany();

    // Filter counts that match the same time window (same hour and same bucket minute)
    const matchingCounts: number[] = [];
    
    for (const count of historicalCounts) {
      const countDate = new Date(count.windowStart);
      const countHour = countDate.getUTCHours();
      const countMinute = countDate.getUTCMinutes();
      const countBucketStartMinute = Math.floor(countMinute / bucketMinutes) * bucketMinutes;
      
      // Match same hour and same bucket start minute
      if (countHour === hour && countBucketStartMinute === bucketStartMinute) {
        const avgCount = typeof count.avgCount === 'string' 
          ? parseFloat(count.avgCount) 
          : count.avgCount;
        matchingCounts.push(avgCount);
      }
    }

    if (matchingCounts.length === 0) {
      return { average: 0, max: 0, count: 0 };
    }

    // Calculate statistics
    const sum = matchingCounts.reduce((a, b) => a + b, 0);
    const average = sum / matchingCounts.length;
    const max = Math.max(...matchingCounts);

    return {
      average: Math.round(average * 10) / 10, // Round to 1 decimal
      max: Math.round(max * 10) / 10,
      count: matchingCounts.length,
    };
  }

  private calculateRelativeIndicator(percentageChange: number): string {
    if (percentageChange >= 50) return 'Much Busier';
    if (percentageChange >= 20) return 'Busier';
    if (percentageChange >= -20) return 'Similar';
    if (percentageChange >= -50) return 'Quieter';
    return 'Much Quieter';
  }

  private calculateBusynessLevel(count: number): string {
    // Updated thresholds to align with widget gauge (0, <3, <8, <12, <18, 18+)
    if (count === 0) return 'Empty';
    if (count < 3) return 'Low';
    if (count < 8) return 'Medium';
    if (count < 12) return 'High';
    if (count < 18) return 'Very High';
    return 'Very High';
  }
}

