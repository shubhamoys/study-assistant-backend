import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsBoolean,
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

/** `isActive: false` is how a coupon is retired — there's no delete mutation, see Coupon's doc comment. */
@InputType()
export class UpdateCouponInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @MinLength(3, { message: 'Code must be at least 3 characters' })
  @MaxLength(30)
  code?: string;

  @Field(() => CouponDiscountType, { nullable: true })
  @IsOptional()
  @IsEnum(CouponDiscountType)
  discountType?: CouponDiscountType;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000_00)
  discountValue?: number;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  expiresAt?: Date | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderAmount?: number | null;
}
