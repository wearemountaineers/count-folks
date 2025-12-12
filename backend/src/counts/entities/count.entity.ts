import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('counts')
@Index(['streamId', 'windowStart'])
@Index(['windowStart', 'windowEnd'])
export class Count {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  streamId: string;

  @Column({ type: 'timestamp' })
  windowStart: Date;

  @Column({ type: 'timestamp' })
  windowEnd: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  avgCount: number;

  @CreateDateColumn()
  createdAt: Date;
}

