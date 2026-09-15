import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { PaymentGateway, PaymentStatus } from '../../../database/enums';

registerEnumType(PaymentGateway, { name: 'PaymentGateway' });
registerEnumType(PaymentStatus, { name: 'PaymentStatus' });

@ObjectType('Payment')
export class PaymentType {
  @Field(() => ID)
  id!: string;

  @Field(() => PaymentGateway)
  paymentGateway!: PaymentGateway;

  @Field()
  transactionId!: string;

  @Field(() => Int)
  amount!: number;

  @Field(() => PaymentStatus)
  status!: PaymentStatus;

  @Field()
  createdAt!: Date;
}
