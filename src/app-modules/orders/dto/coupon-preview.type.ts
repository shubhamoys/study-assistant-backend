import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Read-only preview of applying a coupon to the current cart — returned by
 * `previewCoupon`, never persisted, never increments `Coupon.redemptionsCount`
 * (only `checkout` does that). Lets the /checkout page show the discount
 * breakdown before the user commits to paying.
 */
@ObjectType('CouponPreview')
export class CouponPreviewType {
  @Field()
  code!: string;

  @Field(() => Int)
  subtotalAmount!: number;

  @Field(() => Int)
  discountAmount!: number;

  @Field(() => Int)
  totalAmount!: number;
}
