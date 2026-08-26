import { Query, Resolver } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities';
import { HealthStatus } from './models/health-status.model';

@Resolver()
export class HealthResolver {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  @Query(() => HealthStatus, {
    description:
      'Reports API and database liveness — used to verify the dev environment is wired correctly.',
  })
  async health(): Promise<HealthStatus> {
    let database = 'up';
    try {
      await this.userRepository.count();
    } catch {
      database = 'down';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database,
    };
  }
}
