import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
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
}
