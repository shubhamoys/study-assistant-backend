import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Flashcard } from '../study/entities/flashcard.entity';
import { Deck } from '../store/entities/deck.entity';
import { CartItem } from './entities/cart-item.entity';

// Same heuristic as StoreService/LibraryService — see their comment.
const ESTIMATED_MINUTES_PER_CARD = 2;

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Deck) private readonly deckRepository: Repository<Deck>,
  ) {}

  findForUser(userId: string): Promise<CartItem[]> {
    const qb = this.cartQueryBuilder()
      .where('cartItem.userId = :userId', { userId })
      .orderBy('cartItem.createdAt', 'DESC');
    return this.withComputedFields(qb);
  }

  async addDeck(userId: string, deckId: string): Promise<CartItem> {
    const deck = await this.deckRepository.findOneBy({
      id: deckId,
      isPublic: true,
    });
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }
    // Only a paid deck ever needs a cart — a free one is a one-click
    // `addDeckToLibrary` away, and a custom/private deck is never public so
    // it already 404'd above.
    if (deck.isFree) {
      throw new ConflictException(
        'This deck is free — add it directly to your library instead.',
      );
    }

    const existing = await this.cartItemRepository.findOneBy({
      userId,
      deckId,
    });
    if (existing) {
      throw new ConflictException('Deck is already in your cart');
    }

    const saved = await this.cartItemRepository.save(
      this.cartItemRepository.create({ userId, deckId }),
    );
    const qb = this.cartQueryBuilder().where('cartItem.id = :id', {
      id: saved.id,
    });
    const [entry] = await this.withComputedFields(qb);
    return entry;
  }

  async removeDeck(userId: string, deckId: string): Promise<boolean> {
    const result = await this.cartItemRepository.delete({ userId, deckId });
    if (!result.affected) {
      throw new NotFoundException('Deck not found in your cart');
    }
    return true;
  }

  private cartQueryBuilder(): SelectQueryBuilder<CartItem> {
    return this.cartItemRepository
      .createQueryBuilder('cartItem')
      .leftJoinAndSelect('cartItem.deck', 'deck')
      .leftJoinAndSelect('deck.category', 'category')
      .leftJoinAndSelect('deck.author', 'author');
  }

  /** Same correlated-COUNT-subquery pattern as StoreService/LibraryService — see their comment. */
  private async withComputedFields(
    qb: SelectQueryBuilder<CartItem>,
  ): Promise<CartItem[]> {
    qb.addSelect(
      (subQb) =>
        subQb
          .select('COUNT(*)', 'count')
          .from(Flashcard, 'flashcard')
          .where('flashcard.deckId = deck.id'),
      'cardCount',
    );
    const { entities, raw } = await qb.getRawAndEntities<{
      cardCount: string;
    }>();
    entities.forEach((entry, index) => {
      entry.deck.cardCount = Number(raw[index]?.cardCount ?? 0);
      entry.deck.authorDisplayName =
        entry.deck.author?.displayName ?? 'Unknown';
      entry.deck.estimatedStudyMinutes = Math.max(
        1,
        entry.deck.cardCount * ESTIMATED_MINUTES_PER_CARD,
      );
    });
    return entities;
  }
}
