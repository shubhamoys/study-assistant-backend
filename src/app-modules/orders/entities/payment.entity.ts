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
 * One row per checkout attempt on an order — today that's always exactly
 * one MANUAL-gateway row created the instant checkout completes (see
 * OrdersService.checkout). Kept as its own table, not folded into Order,
 * so a real gateway integration (Razorpay) can later add rows here —
 * retries, webhook-driven status updates — without touching Order's shape.
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

  /** Full gateway response payload — always null for the MANUAL stub; populated once Razorpay lands. */
  @Column({ type: 'jsonb', nullable: true })
  rawResponse!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
