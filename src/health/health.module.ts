import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities';
import { HealthResolver } from './health.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [HealthResolver],
})
export class HealthModule {}
