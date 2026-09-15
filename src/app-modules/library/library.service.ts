import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Difficulty } from '../../database/enums';
import { Flashcard } from '../study/entities/flashcard.entity';
import { Deck } from '../store/entities/deck.entity';
import { LibrarySortOrder } from './dto/library-sort-order.enum';
import { Library } from './entities/library.entity';

export interface LibraryQueryOptions {
  categoryId?: string;
  search?: string;
  difficulty?: Difficulty;
  sort?: LibrarySortOrder;
}

// Same heuristic as StoreService — see its comment.
const ESTIMATED_MINUTES_PER_CARD = 2;

@Injectable()
export class LibraryService {
  constructor(
    @InjectRepository(Library)
    private readonly libraryRepository: Repository<Library>,
    @InjectRepository(Deck) private readonly deckRepository: Repository<Deck>,
  ) {}

  findForUser(
    userId: string,
    options: LibraryQueryOptions = {},
  ): Promise<Library[]> {
    const qb = this.libraryQueryBuilder().where('library.userId = :userId', {
      userId,
    });
    this.applyFilters(qb, options);
    this.applySort(qb, options.sort);
    return this.withComputedFields(qb);
  }

  async addDeck(userId: string, deckId: string): Promise<Library> {
    // A deck is addable if it's public (Store-browsable, e.g. a seeded
    // system deck), or if it's the caller's own private/custom deck —
    // `createDeck` already auto-enrolls the author, so this branch mainly
    // matters if that enrollment was ever removed. Anyone else's private
    // deck is neither, so this still 404s the same as "doesn't exist."
    const deck = await this.deckRepository.findOne({
      where: [
        { id: deckId, isPublic: true },
        { id: deckId, authorId: userId },
      ],
    });
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }
    // A custom/private deck is always free (never exposed a way to set
    // isFree:false), so this only ever fires for a paid admin-created Store
    // deck — those are only ever acquired through cart → checkout (Phase 4
    // checkpoint 1/2), never this direct one-click path.
    if (!deck.isFree) {
      throw new ForbiddenException(
        'This deck must be purchased — add it to your cart instead.',
      );
    }

    const existing = await this.libraryRepository.findOneBy({
      userId,
      deckId,
    });
    if (existing) {
      throw new ConflictException('Deck is already in your library');
    }

    const saved = await this.libraryRepository.save(
      this.libraryRepository.create({ userId, deckId }),
    );
    // "Downloads" is a cumulative history count, not "currently in a
    // library" — deliberately never decremented on remove, same semantics
    // as an app store's install counter.
    await this.deckRepository.increment({ id: deckId }, 'downloadsCount', 1);

    const qb = this.libraryQueryBuilder().where('library.id = :id', {
      id: saved.id,
    });
    const [entry] = await this.withComputedFields(qb);
    return entry;
  }

  async removeDeck(userId: string, deckId: string): Promise<boolean> {
    const entry = await this.libraryRepository.findOne({
      where: { userId, deckId },
      relations: { deck: true },
    });
    if (!entry) {
      throw new NotFoundException('Deck not found in your library');
    }
    // A purchase is permanent — removing it here would be an easy way to
    // accidentally lose access to a deck you paid for, with no undo. Free
    // decks can still be removed and re-added at will.
    if (!entry.deck.isFree) {
      throw new ForbiddenException(
        "Purchased decks can't be removed from your library",
      );
    }
    await this.libraryRepository.delete({ userId, deckId });
    return true;
  }

  private applyFilters(
    qb: SelectQueryBuilder<Library>,
    { categoryId, search, difficulty }: LibraryQueryOptions,
  ): void {
    if (categoryId) {
      qb.andWhere('deck.categoryId = :categoryId', { categoryId });
    }
    if (search) {
      qb.andWhere(
        '(deck.title ILIKE :search OR deck.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (difficulty) {
      qb.andWhere('deck.difficulty = :difficulty', { difficulty });
    }
  }

  private applySort(
    qb: SelectQueryBuilder<Library>,
    sort?: LibrarySortOrder,
  ): void {
    switch (sort) {
      case LibrarySortOrder.TITLE:
        qb.orderBy('deck.title', 'ASC');
        break;
      case LibrarySortOrder.LAST_STUDIED:
        qb.orderBy('library.lastStudiedAt', 'DESC', 'NULLS LAST');
        break;
      case LibrarySortOrder.RATING:
        qb.orderBy('deck.ratingAverage', 'DESC');
        break;
      case LibrarySortOrder.RECENT:
      default:
        qb.orderBy('library.createdAt', 'DESC');
        break;
    }
  }

  private libraryQueryBuilder(): SelectQueryBuilder<Library> {
    return this.libraryRepository
      .createQueryBuilder('library')
      .leftJoinAndSelect('library.deck', 'deck')
      .leftJoinAndSelect('deck.category', 'category')
      .leftJoinAndSelect('deck.author', 'author');
  }

  /** Same correlated-COUNT-subquery pattern as StoreService — see its comment. */
  private async withComputedFields(
    qb: SelectQueryBuilder<Library>,
  ): Promise<Library[]> {
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
