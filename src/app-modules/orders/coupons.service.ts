import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CouponDiscountType } from '../../database/enums';
import { CreateCouponInput } from './dto/create-coupon.input';
import { UpdateCouponInput } from './dto/update-coupon.input';
import { Coupon } from './entities/coupon.entity';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
  ) {}

  findAll(): Promise<Coupon[]> {
    return this.couponRepository.find({ order: { createdAt: 'DESC' } });
  }

  async create(input: CreateCouponInput): Promise<Coupon> {
    const code = input.code.trim().toUpperCase();
    await this.assertCodeAvailable(code);
    this.assertPercentageInRange(input.discountType, input.discountValue);
    return this.couponRepository.save(
      this.couponRepository.create({
        code,
        discountType: input.discountType,
        discountValue: input.discountValue,
        expiresAt: input.expiresAt ?? null,
        maxRedemptions: input.maxRedemptions ?? null,
        minOrderAmount: input.minOrderAmount ?? null,
      }),
    );
  }

  async update(id: string, input: UpdateCouponInput): Promise<Coupon> {
    const coupon = await this.couponRepository.findOneBy({ id });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (input.code !== undefined) {
      const code = input.code.trim().toUpperCase();
      await this.assertCodeAvailable(code, id);
      coupon.code = code;
    }
    if (input.discountType !== undefined) {
      coupon.discountType = input.discountType;
    }
    if (input.discountValue !== undefined) {
      coupon.discountValue = input.discountValue;
    }
    this.assertPercentageInRange(coupon.discountType, coupon.discountValue);
    if (input.isActive !== undefined) {
      coupon.isActive = input.isActive;
    }
    if (input.expiresAt !== undefined) {
      coupon.expiresAt = input.expiresAt;
    }
    if (input.maxRedemptions !== undefined) {
      coupon.maxRedemptions = input.maxRedemptions;
    }
    if (input.minOrderAmount !== undefined) {
      coupon.minOrderAmount = input.minOrderAmount;
    }
    return this.couponRepository.save(coupon);
  }

  private async assertCodeAvailable(
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.couponRepository.findOneBy({ code });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('A coupon with this code already exists');
    }
  }

  /** class-validator can't express "discountValue <= 100 only when discountType is PERCENTAGE" declaratively, so it's checked here instead. */
  private assertPercentageInRange(
    discountType: CouponDiscountType,
    discountValue: number,
  ): void {
    if (discountType === CouponDiscountType.PERCENTAGE && discountValue > 100) {
      throw new BadRequestException('A percentage discount cannot exceed 100');
    }
  }
}
