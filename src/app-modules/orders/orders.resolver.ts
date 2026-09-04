import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { OrderType } from './dto/order.type';
import { Order } from './entities/order.entity';
import { OrdersService } from './orders.service';

@Resolver()
export class OrdersResolver {
  constructor(private readonly ordersService: OrdersService) {}

  @Query(() => [OrderType])
  myOrders(@CurrentUser() user: User): Promise<Order[]> {
    return this.ordersService.findForUser(user.id);
  }

  @Query(() => OrderType)
  order(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<Order> {
    return this.ordersService.findOne(user.id, id);
  }

  @Mutation(() => OrderType)
  checkout(@CurrentUser() user: User): Promise<Order> {
    return this.ordersService.checkout(user.id);
  }
}
