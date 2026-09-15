import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../app-modules/users/entities/user.entity';
import { HealthResolver } from './health.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [HealthResolver],
})
export class HealthModule {}
