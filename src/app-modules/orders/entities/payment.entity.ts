import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentGateway, PaymentStatus } from '../../../database/enums';
import { Order } from './order.entity';

/**
 * One row per successfully completed order — created only once
 * `OrdersService.finalizeOrder` runs (a real Razorpay payment verified in
 * `verifyPayment`, or a coupon covering the order in full, which stays
 * MANUAL since no money moved). Kept as its own table, not folded into
 * Order, so a failed/retried Razorpay attempt could add further rows here
 * later without touching Order's shape.
 */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order!: Order;

  @Column({ type: 'enum', enum: PaymentGateway })
  paymentGateway!: PaymentGateway;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  transactionId!: string;

  /** Lowest currency unit (paise) — mirrors Order.totalAmount for this attempt. */
  @Column({ type: 'int' })
  amount!: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  /** Full gateway response payload — the fetched Razorpay Payments API response for a real payment, null for a MANUAL (fully-discounted, nothing to charge) order. */
  @Column({ type: 'jsonb', nullable: true })
  rawResponse!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
