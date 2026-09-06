import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

/**
 * Returned by `checkout` (phase 1) — the frontend uses `razorpayOrderId`/
 * `razorpayKeyId`/`amount`/`currency` to open Razorpay's Checkout modal.
 * `requiresPayment: false` means a coupon covered the order in full — it's
 * already COMPLETED, and the frontend should skip straight to the
 * confirmation page instead of opening Razorpay at all.
 */
@ObjectType('CheckoutSession')
export class CheckoutSessionType {
  @Field(() => ID)
  orderId!: string;

  @Field()
  requiresPayment!: boolean;

  @Field(() => String, { nullable: true })
  razorpayOrderId!: string | null;

  @Field(() => String, { nullable: true })
  razorpayKeyId!: string | null;

  @Field(() => Int)
  amount!: number;

  @Field()
  currency!: string;
}
