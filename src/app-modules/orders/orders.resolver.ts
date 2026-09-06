import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CheckoutSessionType } from './dto/checkout-session.type';
import { CouponPreviewType } from './dto/coupon-preview.type';
import { OrderType } from './dto/order.type';
import { VerifyPaymentInput } from './dto/verify-payment.input';
import { Order } from './entities/order.entity';
import { CheckoutSessionResult, OrdersService } from './orders.service';

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

  @Query(() => CouponPreviewType)
  previewCoupon(
    @Args('code') code: string,
    @CurrentUser() user: User,
  ): Promise<CouponPreviewType> {
    return this.ordersService.previewCoupon(user.id, code);
  }

  /** Phase 1 — snapshots the cart and, if anything is owed, opens a Razorpay order. See OrdersService.checkout. */
  @Mutation(() => CheckoutSessionType)
  checkout(
    @CurrentUser() user: User,
    @Args('couponCode', { type: () => String, nullable: true })
    couponCode?: string,
  ): Promise<CheckoutSessionResult> {
    return this.ordersService.checkout(user.id, couponCode);
  }

  /** Phase 2 — the only place a payment is accepted as real. See OrdersService.verifyPayment. */
  @Mutation(() => OrderType)
  verifyPayment(
    @Args('input') input: VerifyPaymentInput,
    @CurrentUser() user: User,
  ): Promise<Order> {
    return this.ordersService.verifyPayment(user.id, input);
  }
}
