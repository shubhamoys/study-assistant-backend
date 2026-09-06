import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import {
  CouponDiscountType,
  OrderStatus,
  PaymentGateway,
  PaymentStatus,
} from '../../database/enums';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Library } from '../library/entities/library.entity';
import { Deck } from '../store/entities/deck.entity';
import { Flashcard } from '../study/entities/flashcard.entity';
import { CouponPreviewType } from './dto/coupon-preview.type';
import { VerifyPaymentInput } from './dto/verify-payment.input';
import { Coupon } from './entities/coupon.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Payment } from './entities/payment.entity';
import { RazorpayClient } from './razorpay-client.service';

// Same heuristic as StoreService/LibraryService/CartService — see their comment.
const ESTIMATED_MINUTES_PER_CARD = 2;

export interface CheckoutSessionResult {
  orderId: string;
  requiresPayment: boolean;
  razorpayOrderId: string | null;
  razorpayKeyId: string | null;
  amount: number;
  currency: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Flashcard)
    private readonly flashcardRepository: Repository<Flashcard>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    private readonly configService: ConfigService,
    private readonly razorpayClient: RazorpayClient,
  ) {}

  /**
   * Phase 1 of checkout — snapshots the cart into a PENDING order and, for
   * anything actually owed, opens a Razorpay order for it. No library
   * access, coupon redemption, or cart-clearing happens here — that's
   * `verifyPayment`'s job, once a real payment has been confirmed. Nothing
   * in this method ever lets the caller influence the amount charged: it's
   * always derived from the server's own view of the cart/coupon, never
   * accepted as an argument.
   */
  async checkout(
    userId: string,
    couponCode?: string,
  ): Promise<CheckoutSessionResult> {
    const pending = await this.dataSource.transaction(async (manager) => {
      // Superseded by this new attempt — stops abandoned/failed checkouts
      // from piling up as forever-PENDING orders every time the user
      // retries with the same cart.
      await manager.update(
        Order,
        { userId, status: OrderStatus.PENDING },
        { status: OrderStatus.CANCELLED },
      );

      const cartItems = await manager.find(CartItem, {
        where: { userId },
        relations: { deck: true },
      });

      // A deck could have gone free or been unpublished since it was added
      // to the cart (an admin edit) — drop it rather than fail the whole
      // checkout. Anything left is what actually gets purchased.
      const purchasable = cartItems.filter(
        (item) => item.deck.isPublic && !item.deck.isFree,
      );
      if (purchasable.length === 0) {
        throw new BadRequestException(
          'Your cart has nothing left to check out',
        );
      }

      // A dropped item doesn't belong in the cart anymore either — it's now
      // either free (which only ever belongs in the library) or
      // unpublished — so it's removed right away, independent of whether
      // payment ever completes. The *purchasable* items deliberately stay
      // in the cart until `finalizeOrder` removes them on confirmed
      // payment — if this checkout is abandoned or fails, the user's cart
      // still has what they were trying to buy, ready to retry.
      const droppedDeckIds = cartItems
        .filter((item) => !purchasable.includes(item))
        .map((item) => item.deckId);
      if (droppedDeckIds.length > 0) {
        await manager.delete(CartItem, { userId, deckId: In(droppedDeckIds) });
      }

      const subtotalAmount = purchasable.reduce(
        (sum, item) => sum + item.deck.price,
        0,
      );

      let coupon: Coupon | null = null;
      let discountAmount = 0;
      if (couponCode) {
        const found = await manager.findOneBy(Coupon, {
          code: normalizeCouponCode(couponCode),
        });
        ({ coupon, discountAmount } = validateAndComputeDiscount(
          found,
          subtotalAmount,
        ));
      }
      const totalAmount = subtotalAmount - discountAmount;

      const order = await manager.save(
        manager.create(Order, {
          userId,
          subtotalAmount,
          discountAmount,
          totalAmount,
          couponId: coupon?.id ?? null,
          couponCode: coupon?.code ?? null,
          currency: 'INR',
          status: OrderStatus.PENDING,
        }),
      );

      await manager.save(
        purchasable.map((item) =>
          manager.create(OrderItem, {
            orderId: order.id,
            deckId: item.deckId,
            price: item.deck.price,
          }),
        ),
      );

      return order;
    });

    // A coupon can cover the order in full — nothing is actually owed, so
    // there's no Razorpay order to open. Complete it the same instant the
    // old stub flow always did (still a real, auditable Payment row —
    // just one with nothing to verify, since no money moves).
    if (pending.totalAmount <= 0) {
      await this.dataSource.transaction((manager) =>
        this.finalizeOrder(manager, pending, {
          paymentGateway: PaymentGateway.MANUAL,
          transactionId: `FULL-DISCOUNT-${randomUUID()}`,
          rawResponse: null,
        }),
      );
      return {
        orderId: pending.id,
        requiresPayment: false,
        razorpayOrderId: null,
        razorpayKeyId: null,
        amount: 0,
        currency: pending.currency,
      };
    }

    // Deliberately outside the DB transaction above — an external HTTP call
    // has no business holding a database transaction open.
    let razorpayOrderId: string;
    try {
      const razorpayOrder = await this.razorpayClient.createOrder({
        amount: pending.totalAmount,
        currency: pending.currency,
        receipt: pending.id,
      });
      razorpayOrderId = razorpayOrder.id;
    } catch {
      await this.orderRepository.update(pending.id, {
        status: OrderStatus.FAILED,
      });
      throw new BadRequestException(
        'Could not start payment right now — please try again',
      );
    }
    await this.orderRepository.update(pending.id, { razorpayOrderId });

    return {
      orderId: pending.id,
      requiresPayment: true,
      razorpayOrderId,
      razorpayKeyId: this.configService.get<string>('razorpay.keyId') ?? null,
      amount: pending.totalAmount,
      currency: pending.currency,
    };
  }

  /**
   * Phase 2 of checkout — the only place a payment is ever accepted as
   * "real." Three independent checks all have to pass before anything is
   * granted, each closing a different bypass:
   *  1. `razorpayOrderId` must match the one *this specific* internal order
   *     was opened with — stops a valid signature from a different (e.g.
   *     cheaper) checkout being replayed against a pricier order.
   *  2. The HMAC signature must verify against our key secret — proves
   *     Razorpay itself, not the client, is vouching for this exact
   *     (order, payment) pair. The secret never reaches the frontend, so a
   *     client cannot forge this.
   *  3. A direct server-to-server fetch of the payment from Razorpay must
   *     show it `captured`, for this order, for the exact amount and
   *     currency we charged — defense-in-depth in case the signature check
   *     above is ever weakened by a future change.
   * Idempotent: calling this again for an already-COMPLETED order just
   * returns it, rather than re-granting or erroring.
   */
  async verifyPayment(
    userId: string,
    input: VerifyPaymentInput,
  ): Promise<Order> {
    const order = await this.orderRepository.findOneBy({
      id: input.orderId,
      userId,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status === OrderStatus.COMPLETED) {
      return this.findOne(userId, order.id);
    }
    if (order.status !== OrderStatus.PENDING || !order.razorpayOrderId) {
      throw new BadRequestException('This order is no longer awaiting payment');
    }
    if (input.razorpayOrderId !== order.razorpayOrderId) {
      throw new BadRequestException('Payment does not match this order');
    }

    const signatureValid = this.razorpayClient.verifySignature(
      input.razorpayOrderId,
      input.razorpayPaymentId,
      input.razorpaySignature,
    );
    if (!signatureValid) {
      throw new BadRequestException('Payment verification failed');
    }

    const payment = await this.razorpayClient.fetchPayment(
      input.razorpayPaymentId,
    );
    const paymentAmountValid =
      payment.order_id === order.razorpayOrderId &&
      payment.status === 'captured' &&
      Number(payment.amount) === order.totalAmount &&
      payment.currency === order.currency;
    if (!paymentAmountValid) {
      throw new BadRequestException('Payment verification failed');
    }

    await this.dataSource.transaction((manager) =>
      this.finalizeOrder(manager, order, {
        paymentGateway: PaymentGateway.RAZORPAY,
        transactionId: payment.id,
        rawResponse: payment as unknown as Record<string, unknown>,
      }),
    );

    return this.findOne(userId, order.id);
  }

  /**
   * The only place an order actually becomes COMPLETED — called either for
   * a zero-amount (fully-discounted) order or after `verifyPayment` accepts
   * a real payment. Grants library access, bumps download counts, redeems
   * the coupon (if any), and clears *only the items this order actually
   * covers* from the cart — not the whole cart, since time has passed since
   * `checkout` snapshotted it and the user may have added something new
   * since (unlike the old instant-complete flow, where that gap didn't
   * exist).
   */
  private async finalizeOrder(
    manager: EntityManager,
    order: Order,
    paymentDetails: {
      paymentGateway: PaymentGateway;
      transactionId: string;
      rawResponse: Record<string, unknown> | null;
    },
  ): Promise<void> {
    const items = await manager.find(OrderItem, {
      where: { orderId: order.id },
    });

    await manager.save(
      manager.create(Payment, {
        orderId: order.id,
        paymentGateway: paymentDetails.paymentGateway,
        transactionId: paymentDetails.transactionId,
        amount: order.totalAmount,
        status: PaymentStatus.SUCCESS,
        rawResponse: paymentDetails.rawResponse,
      }),
    );

    await manager.update(Order, order.id, { status: OrderStatus.COMPLETED });

    if (order.couponId) {
      await manager.increment(
        Coupon,
        { id: order.couponId },
        'redemptionsCount',
        1,
      );
    }

    const deckIds = items.map((item) => item.deckId);
    for (const deckId of deckIds) {
      const alreadyOwned = await manager.findOneBy(Library, {
        userId: order.userId,
        deckId,
      });
      if (!alreadyOwned) {
        await manager.save(
          manager.create(Library, { userId: order.userId, deckId }),
        );
        await manager.increment(Deck, { id: deckId }, 'downloadsCount', 1);
      }
    }

    await manager.delete(CartItem, {
      userId: order.userId,
      deckId: In(deckIds),
    });
  }

  /**
   * Read-only — validates a coupon against the user's *current* cart total
   * without touching redemptionsCount or persisting anything, so the
   * /checkout page can show a discount breakdown before the user commits to
   * paying. `checkout` re-validates independently; this is purely a preview.
   */
  async previewCoupon(
    userId: string,
    couponCode: string,
  ): Promise<CouponPreviewType> {
    const cartItems = await this.cartItemRepository.find({
      where: { userId },
      relations: { deck: true },
    });
    const purchasable = cartItems.filter(
      (item) => item.deck.isPublic && !item.deck.isFree,
    );
    if (purchasable.length === 0) {
      throw new BadRequestException('Your cart has nothing to check out');
    }
    const subtotalAmount = purchasable.reduce(
      (sum, item) => sum + item.deck.price,
      0,
    );

    const found = await this.couponRepository.findOneBy({
      code: normalizeCouponCode(couponCode),
    });
    const { coupon, discountAmount } = validateAndComputeDiscount(
      found,
      subtotalAmount,
    );

    return {
      code: coupon.code,
      subtotalAmount,
      discountAmount,
      totalAmount: subtotalAmount - discountAmount,
    };
  }

  findForUser(userId: string): Promise<Order[]> {
    const qb = this.orderQueryBuilder()
      .where('order.userId = :userId', { userId })
      .andWhere('order.status != :cancelled', {
        cancelled: OrderStatus.CANCELLED,
      })
      .orderBy('order.createdAt', 'DESC');
    return this.withComputedFields(qb);
  }

  async findOne(userId: string, id: string): Promise<Order> {
    const qb = this.orderQueryBuilder().where(
      'order.id = :id AND order.userId = :userId',
      { id, userId },
    );
    const [order] = await this.withComputedFields(qb);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private orderQueryBuilder(): SelectQueryBuilder<Order> {
    return this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.deck', 'deck')
      .leftJoinAndSelect('deck.category', 'category')
      .leftJoinAndSelect('deck.author', 'author')
      .leftJoinAndSelect('order.payments', 'payments');
  }

  /** Same correlated-COUNT-subquery pattern as StoreService/LibraryService/CartService — see their comment. */
  private async withComputedFields(
    qb: SelectQueryBuilder<Order>,
  ): Promise<Order[]> {
    const orders = await qb.getMany();
    const deckIds = orders.flatMap((order) =>
      order.items.map((item) => item.deckId),
    );
    if (deckIds.length === 0) {
      return orders;
    }

    const counts = await this.flashcardRepository
      .createQueryBuilder('flashcard')
      .select('flashcard.deckId', 'deckId')
      .addSelect('COUNT(*)', 'count')
      .where('flashcard.deckId IN (:...deckIds)', { deckIds })
      .groupBy('flashcard.deckId')
      .getRawMany<{ deckId: string; count: string }>();
    const countByDeckId = new Map(
      counts.map((row) => [row.deckId, Number(row.count)]),
    );

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const cardCount = countByDeckId.get(item.deckId) ?? 0;
        item.deck.cardCount = cardCount;
        item.deck.authorDisplayName =
          item.deck.author?.displayName ?? 'Unknown';
        item.deck.estimatedStudyMinutes = Math.max(
          1,
          cardCount * ESTIMATED_MINUTES_PER_CARD,
        );
      });
    });
    return orders;
  }
}

function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Shared by `checkout` (transactional lookup via EntityManager) and
 * `previewCoupon` (plain repository lookup) — both fetch the `Coupon` row
 * differently, but the validation/math is identical, so it lives here once
 * rather than in the class where it'd have to be duplicated per lookup path.
 */
function validateAndComputeDiscount(
  coupon: Coupon | null,
  subtotalAmount: number,
): { coupon: Coupon; discountAmount: number } {
  if (!coupon || !coupon.isActive) {
    throw new NotFoundException('Invalid coupon code');
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    throw new BadRequestException('This coupon has expired');
  }
  if (
    coupon.maxRedemptions !== null &&
    coupon.redemptionsCount >= coupon.maxRedemptions
  ) {
    throw new BadRequestException('This coupon has reached its usage limit');
  }
  if (
    coupon.minOrderAmount !== null &&
    subtotalAmount < coupon.minOrderAmount
  ) {
    throw new BadRequestException(
      "Your order doesn't meet this coupon's minimum amount",
    );
  }

  const discountAmount =
    coupon.discountType === CouponDiscountType.PERCENTAGE
      ? Math.round((subtotalAmount * coupon.discountValue) / 100)
      : Math.min(coupon.discountValue, subtotalAmount);

  return { coupon, discountAmount };
}
