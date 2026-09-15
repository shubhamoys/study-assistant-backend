import { Field, ID, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

@InputType()
export class VerifyPaymentInput {
  @Field(() => ID)
  @IsUUID()
  orderId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  razorpayOrderId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  razorpayPaymentId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  razorpaySignature!: string;
}
