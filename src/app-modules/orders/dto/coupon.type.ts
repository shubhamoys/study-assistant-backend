import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { CouponDiscountType } from '../../../database/enums';

registerEnumType(CouponDiscountType, { name: 'CouponDiscountType' });

@ObjectType('Coupon')
export class CouponType {
  @Field(() => ID)
  id!: string;

  @Field()
  code!: string;

  @Field(() => CouponDiscountType)
  discountType!: CouponDiscountType;

  @Field(() => Int)
  discountValue!: number;

  @Field()
  isActive!: boolean;

  @Field(() => Date, { nullable: true })
  expiresAt!: Date | null;

  @Field(() => Int, { nullable: true })
  maxRedemptions!: number | null;

  @Field(() => Int)
  redemptionsCount!: number;

  @Field(() => Int, { nullable: true })
  minOrderAmount!: number | null;

  @Field()
  createdAt!: Date;
}
