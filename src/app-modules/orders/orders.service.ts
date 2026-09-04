import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import {
  OrderStatus,
  PaymentGateway,
  PaymentStatus,
} from '../../database/enums';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Library } from '../library/entities/library.entity';
import { Deck } from '../store/entities/deck.entity';
import { Flashcard } from '../study/entities/flashcard.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Payment } from './entities/payment.entity';

// Same heuristic as StoreService/LibraryService/CartService — see their comment.
const ESTIMATED_MINUTES_PER_CARD = 2;

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Flashcard)
    private readonly flashcardRepository: Repository<Flashcard>,
  ) {}

  /**
   * Whole-cart checkout — no partial selection (matches the roadmap's
   * checkpoint 2 scope). Everything below happens in one transaction: an
   * order that ends up COMPLETED must have really granted library access,
   * never a partial state. Instant "payment" — see the Payment entity's
   * doc comment for why this is the deliberate stub the whole checkpoint
   * is scoped around.
   */
  async checkout(userId: string): Promise<Order> {
    const orderId = await this.dataSource.transaction(async (manager) => {
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

      const totalAmount = purchasable.reduce(
        (sum, item) => sum + item.deck.price,
        0,
      );

      const order = await manager.save(
        manager.create(Order, {
          userId,
          totalAmount,
          currency: 'INR',
          status: OrderStatus.COMPLETED,
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

      await manager.save(
        manager.create(Payment, {
          orderId: order.id,
          paymentGateway: PaymentGateway.MANUAL,
          transactionId: `MANUAL-${randomUUID()}`,
          amount: totalAmount,
          status: PaymentStatus.SUCCESS,
        }),
      );

      // Grant access the same way a free deck does — skip a deck the buyer
      // somehow already owns (shouldn't happen given the cart's own
      // add-time checks, but cheap to guard rather than crash on a unique
      // constraint) rather than double-count its download.
      for (const item of purchasable) {
        const alreadyOwned = await manager.findOneBy(Library, {
          userId,
          deckId: item.deckId,
        });
        if (!alreadyOwned) {
          await manager.save(
            manager.create(Library, { userId, deckId: item.deckId }),
          );
          await manager.increment(
            Deck,
            { id: item.deckId },
            'downloadsCount',
            1,
          );
        }
      }

      // Clears the *whole* cart, not just the purchased items — a dropped
      // item (see the filter above) doesn't belong in the cart anymore
      // either (it's now either free, which only ever belongs in the
      // library, or unpublished), so leaving it behind would strand it
      // there with no way to remove it short of a manual removeDeckFromCart.
      await manager.delete(CartItem, { userId });

      return order.id;
    });

    return this.findOne(userId, orderId);
  }

  findForUser(userId: string): Promise<Order[]> {
    const qb = this.orderQueryBuilder()
      .where('order.userId = :userId', { userId })
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
