import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CouponDiscountType } from '../../../database/enums';

/**
 * Admin-managed discount codes, applied at checkout (see
 * OrdersService.checkout). Never hard-deleted through the API — only
 * deactivated (`isActive: false`) via updateCoupon, so a past Order's
 * `couponId` always resolves to a real row even after a coupon is retired.
 */
@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 30, unique: true })
  code!: string;

  @Column({ type: 'enum', enum: CouponDiscountType })
  discountType!: CouponDiscountType;

  /** Percentage (1-100) if `discountType` is PERCENTAGE, otherwise paise. */
  @Column({ type: 'int' })
  discountValue!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  /** Total redemptions allowed across all users — null means unlimited. */
  @Column({ type: 'int', nullable: true })
  maxRedemptions!: number | null;

  @Column({ type: 'int', default: 0 })
  redemptionsCount!: number;

  /** Order subtotal (paise) required before this coupon can be applied — null means no minimum. */
  @Column({ type: 'int', nullable: true })
  minOrderAmount!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
