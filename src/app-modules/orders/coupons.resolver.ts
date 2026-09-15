import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../database/enums';
import { CouponsService } from './coupons.service';
import { CouponType } from './dto/coupon.type';
import { CreateCouponInput } from './dto/create-coupon.input';
import { UpdateCouponInput } from './dto/update-coupon.input';
import { Coupon } from './entities/coupon.entity';

@Resolver()
export class CouponsResolver {
  constructor(private readonly couponsService: CouponsService) {}

  @Query(() => [CouponType])
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  adminCoupons(): Promise<Coupon[]> {
    return this.couponsService.findAll();
  }

  @Mutation(() => CouponType)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createCoupon(@Args('input') input: CreateCouponInput): Promise<Coupon> {
    return this.couponsService.create(input);
  }

  @Mutation(() => CouponType)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateCoupon(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCouponInput,
  ): Promise<Coupon> {
    return this.couponsService.update(id, input);
  }
}
