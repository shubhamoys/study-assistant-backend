import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { OrderStatus } from '../../../database/enums';
import { OrderItemType } from './order-item.type';
import { PaymentType } from './payment.type';

registerEnumType(OrderStatus, { name: 'OrderStatus' });

@ObjectType('Order')
export class OrderType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  totalAmount!: number;

  @Field()
  currency!: string;

  @Field(() => OrderStatus)
  status!: OrderStatus;

  @Field(() => [OrderItemType])
  items!: OrderItemType[];

  @Field(() => [PaymentType])
  payments!: PaymentType[];

  @Field()
  createdAt!: Date;
}
