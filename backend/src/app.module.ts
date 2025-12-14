import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountsModule } from './counts/counts.module';
import { AuthModule } from './auth/auth.module';
import { Count } from './counts/entities/count.entity';
import { User } from './auth/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'countfolks',
      entities: [Count, User],
      synchronize: true, // Set to false in production and use migrations
      logging: false,
    }),
    AuthModule,
    CountsModule,
  ],
})
export class AppModule {}

