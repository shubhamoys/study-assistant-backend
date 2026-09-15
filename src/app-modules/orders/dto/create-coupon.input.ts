import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CouponDiscountType } from '../../../database/enums';

/** No `isActive`/`redemptionsCount` fields — every coupon starts active with zero redemptions. */
@InputType()
export class CreateCouponInput {
  @Field()
  @MinLength(3, { message: 'Code must be at least 3 characters' })
  @MaxLength(30)
  code!: string;

  @Field(() => CouponDiscountType)
  @IsEnum(CouponDiscountType)
  discountType!: CouponDiscountType;

  /** Percentage (1-100) if discountType is PERCENTAGE, otherwise paise. Upper bound enforced server-side for PERCENTAGE — see CouponsService. */
  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(100_000_00)
  discountValue!: number;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  expiresAt?: Date;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderAmount?: number;
}
