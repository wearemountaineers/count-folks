import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountsModule } from './counts/counts.module';
import { Count } from './counts/entities/count.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'countfolks',
      entities: [Count],
      synchronize: true, // Set to false in production and use migrations
      logging: false,
    }),
    CountsModule,
  ],
})
export class AppModule {}

