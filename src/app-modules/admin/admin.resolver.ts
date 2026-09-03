import { Query, Resolver } from '@nestjs/graphql';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../database/enums';
import { AdminService } from './admin.service';
import { AdminAnalytics } from './dto/analytics.type';
import { AdminDashboardStats } from './dto/dashboard-stats.type';

@Resolver()
export class AdminResolver {
  constructor(private readonly adminService: AdminService) {}

  @Query(() => AdminDashboardStats)
  @Roles(UserRole.ADMIN)
  adminDashboardStats(): Promise<AdminDashboardStats> {
    return this.adminService.getDashboardStats();
  }

  @Query(() => AdminAnalytics)
  @Roles(UserRole.ADMIN)
  adminAnalytics(): Promise<AdminAnalytics> {
    return this.adminService.getAnalytics();
  }
}
