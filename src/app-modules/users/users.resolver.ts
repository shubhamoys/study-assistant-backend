import { NotFoundException } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../database/enums';
import { AdminUserPage } from './dto/admin-user-page.type';
import { AdminUsersArgs } from './dto/admin-users.args';
import { CreateAdminUserInput } from './dto/create-admin-user.input';
import { UpdateProfileInput } from './dto/update-profile.input';
import { UserType } from './dto/user.type';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Resolver()
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Mutation(() => UserType)
  updateProfile(
    @Args('input') input: UpdateProfileInput,
    @CurrentUser() user: User,
  ): Promise<User> {
    return this.usersService.update(user.id, {
      displayName: input.displayName,
    });
  }

  @Query(() => AdminUserPage)
  @Roles(UserRole.ADMIN)
  async adminUsers(@Args() args: AdminUsersArgs): Promise<AdminUserPage> {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    const { items, totalCount } = await this.usersService.findManyForAdmin({
      search: args.search,
      role: args.role,
      page,
      limit,
    });
    return {
      items,
      totalCount,
      page,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    };
  }

  @Query(() => UserType)
  @Roles(UserRole.ADMIN)
  async adminUser(@Args('id', { type: () => ID }) id: string): Promise<User> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Mutation(() => UserType)
  @Roles(UserRole.ADMIN)
  adminUpdateUserRole(
    @Args('id', { type: () => ID }) id: string,
    @Args('role', { type: () => UserRole }) role: UserRole,
    @CurrentUser() currentUser: User,
  ): Promise<User> {
    return this.usersService.updateRole(currentUser.id, id, role);
  }

  @Mutation(() => UserType)
  @Roles(UserRole.ADMIN)
  adminCreateAdminUser(
    @Args('input') input: CreateAdminUserInput,
  ): Promise<User> {
    return this.usersService.createAdmin(input);
  }
}
