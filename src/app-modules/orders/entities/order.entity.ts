import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderStatus } from '../../../database/enums';
import { User } from '../../users/entities/user.entity';
import { Coupon } from './coupon.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from './payment.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  /** Lowest currency unit (paise) — sum of every OrderItem.price, before any coupon discount. */
  @Column({ type: 'int' })
  subtotalAmount!: number;

  /** Lowest currency unit (paise) — 0 when no coupon was applied. */
  @Column({ type: 'int', default: 0 })
  discountAmount!: number;

  /** Lowest currency unit (paise) — `subtotalAmount - discountAmount`, what was actually paid. */
  @Column({ type: 'int' })
  totalAmount!: number;

  @Column({ type: 'uuid', nullable: true })
  couponId!: string | null;

  @ManyToOne(() => Coupon, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'couponId' })
  coupon!: Coupon | null;

  /**
   * Snapshot of `coupon.code` at checkout time — same reasoning as
   * `OrderItem.price`: a coupon's own code can change later (or the coupon
   * be deactivated), but this order's history shouldn't drift with it.
   */
  @Column({ type: 'varchar', length: 30, nullable: true })
  couponCode!: string | null;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  /**
   * The Razorpay Order this internal order is paired 1:1 with — set at
   * `initiateCheckout` time, before any payment happens. `verifyPayment`
   * requires the client-submitted Razorpay order id to match this exact
   * value, which is what stops a signature valid for a *different* (e.g.
   * cheaper) transaction from being replayed against this one. Null only
   * for the zero-amount-due case (a coupon fully covers the order), which
   * never goes through Razorpay at all.
   */
  @Index({ unique: true, where: '"razorpayOrderId" IS NOT NULL' })
  @Column({ type: 'varchar', length: 64, nullable: true })
  razorpayOrderId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => OrderItem, (item) => item.order)
  items!: OrderItem[];

  @OneToMany(() => Payment, (payment) => payment.order)
  payments!: Payment[];
}
