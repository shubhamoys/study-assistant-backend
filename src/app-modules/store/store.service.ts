import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Flashcard } from '../study/entities/flashcard.entity';
import { Difficulty } from '../../database/enums';
import { Category } from './entities/category.entity';
import { Deck } from './entities/deck.entity';
import { CreateDeckInput } from './dto/create-deck.input';
import { CreateFlashcardInput } from './dto/create-flashcard.input';
import { DeckSortOrder } from './dto/deck-sort-order.enum';
import { UpdateDeckInput } from './dto/update-deck.input';
import { UpdateFlashcardInput } from './dto/update-flashcard.input';

// Minutes assumed per card for a first-pass study session — a simple,
// documented heuristic (see Deck.estimatedStudyMinutes).
const ESTIMATED_MINUTES_PER_CARD = 2;

export interface DeckQueryOptions {
  categoryId?: string;
  search?: string;
  difficulty?: Difficulty;
  sort?: DeckSortOrder;
}

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Deck) private readonly deckRepository: Repository<Deck>,
    @InjectRepository(Flashcard)
    private readonly flashcardRepository: Repository<Flashcard>,
  ) {}

  findAllCategories(): Promise<Category[]> {
    return this.categoryRepository.find({ order: { name: 'ASC' } });
  }

  async findDecks(options: DeckQueryOptions): Promise<Deck[]> {
    const qb = this.deckQueryBuilder().where('deck.isPublic = true');
    this.applyFilters(qb, options);
    this.applySort(qb, options.sort);
    return this.withComputedFields(qb);
  }

  async findDeckById(id: string): Promise<Deck> {
    const qb = this.deckQueryBuilder()
      .where('deck.id = :id', { id })
      .andWhere('deck.isPublic = true');
    const [deck] = await this.withComputedFields(qb);
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }
    return deck;
  }

  async findMyDecks(userId: string): Promise<Deck[]> {
    const qb = this.deckQueryBuilder()
      .where('deck.authorId = :userId', { userId })
      .orderBy('deck.createdAt', 'DESC');
    return this.withComputedFields(qb);
  }

  async createDeck(userId: string, input: CreateDeckInput): Promise<Deck> {
    const saved = await this.deckRepository.save(
      this.deckRepository.create({
        title: input.title,
        description: input.description ?? null,
        coverUrl: input.coverUrl ?? null,
        categoryId: input.categoryId,
        difficulty: input.difficulty,
        authorId: userId,
        // Every user-created deck is free and immediately public — no
        // draft/publish flow, no pricing UI, until Phase 4 actually does
        // something with a price.
        isPublic: true,
        isFree: true,
        price: 0,
      }),
    );
    return this.findOwnedDeckWithComputedFields(userId, saved.id);
  }

  async updateDeck(
    userId: string,
    deckId: string,
    input: UpdateDeckInput,
  ): Promise<Deck> {
    await this.findOwnedDeckOrFail(userId, deckId);
    await this.deckRepository.update(deckId, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.coverUrl !== undefined && { coverUrl: input.coverUrl }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.difficulty !== undefined && { difficulty: input.difficulty }),
    });
    return this.findOwnedDeckWithComputedFields(userId, deckId);
  }

  async deleteDeck(userId: string, deckId: string): Promise<boolean> {
    await this.findOwnedDeckOrFail(userId, deckId);
    // Soft delete — Deck.deletedAt already exists for this; TypeORM's query
    // builder excludes soft-deleted rows by default, so `decks`/`deck(id)`/
    // `myLibrary` need no extra filtering (see DATABASE_DESIGN.md, which
    // documents this as the intended mechanism).
    await this.deckRepository.softDelete(deckId);
    return true;
  }

  async findDeckFlashcards(
    userId: string,
    deckId: string,
  ): Promise<Flashcard[]> {
    await this.findOwnedDeckOrFail(userId, deckId);
    return this.flashcardRepository.find({
      where: { deckId },
      order: { orderIndex: 'ASC' },
    });
  }

  async createFlashcard(
    userId: string,
    input: CreateFlashcardInput,
  ): Promise<Flashcard> {
    await this.findOwnedDeckOrFail(userId, input.deckId);
    const orderIndex =
      input.orderIndex ?? (await this.nextFlashcardOrderIndex(input.deckId));
    return this.flashcardRepository.save(
      this.flashcardRepository.create({
        deckId: input.deckId,
        front: input.front,
        back: input.back,
        orderIndex,
      }),
    );
  }

  async updateFlashcard(
    userId: string,
    flashcardId: string,
    input: UpdateFlashcardInput,
  ): Promise<Flashcard> {
    const flashcard = await this.findOwnedFlashcardOrFail(userId, flashcardId);
    if (input.front !== undefined) flashcard.front = input.front;
    if (input.back !== undefined) flashcard.back = input.back;
    if (input.orderIndex !== undefined) flashcard.orderIndex = input.orderIndex;
    return this.flashcardRepository.save(flashcard);
  }

  async deleteFlashcard(userId: string, flashcardId: string): Promise<boolean> {
    const flashcard = await this.findOwnedFlashcardOrFail(userId, flashcardId);
    await this.flashcardRepository.softDelete(flashcard.id);
    return true;
  }

  /**
   * `{ id, authorId }` both in the lookup merges "doesn't exist" and "isn't
   * yours" into one `NotFoundException` — same don't-leak-details pattern
   * `ReviewsService.findOwnedOrFail` already established.
   */
  private async findOwnedDeckOrFail(
    userId: string,
    deckId: string,
  ): Promise<Deck> {
    const deck = await this.deckRepository.findOneBy({
      id: deckId,
      authorId: userId,
    });
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }
    return deck;
  }

  private async findOwnedFlashcardOrFail(
    userId: string,
    flashcardId: string,
  ): Promise<Flashcard> {
    const flashcard = await this.flashcardRepository.findOne({
      where: { id: flashcardId },
      relations: { deck: true },
    });
    if (!flashcard || flashcard.deck.authorId !== userId) {
      throw new NotFoundException('Flashcard not found');
    }
    return flashcard;
  }

  private async nextFlashcardOrderIndex(deckId: string): Promise<number> {
    const raw = await this.flashcardRepository
      .createQueryBuilder('flashcard')
      .select('MAX(flashcard.orderIndex)', 'max')
      .where('flashcard.deckId = :deckId', { deckId })
      .getRawOne<{ max: number | string | null }>();
    // `raw?.max ? ... : -1` would be wrong here — 0 is a valid existing
    // orderIndex and is falsy, so that check must be null/undefined-only.
    const max =
      raw?.max === null || raw?.max === undefined ? -1 : Number(raw.max);
    return max + 1;
  }

  private async findOwnedDeckWithComputedFields(
    userId: string,
    deckId: string,
  ): Promise<Deck> {
    const qb = this.deckQueryBuilder().where(
      'deck.id = :deckId AND deck.authorId = :userId',
      { deckId, userId },
    );
    const [deck] = await this.withComputedFields(qb);
    return deck;
  }

  private applyFilters(
    qb: SelectQueryBuilder<Deck>,
    { categoryId, search, difficulty }: DeckQueryOptions,
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

  private applySort(qb: SelectQueryBuilder<Deck>, sort?: DeckSortOrder): void {
    switch (sort) {
      case DeckSortOrder.RATING:
        qb.orderBy('deck.ratingAverage', 'DESC').addOrderBy(
          'deck.ratingCount',
          'DESC',
        );
        break;
      case DeckSortOrder.DOWNLOADS:
        qb.orderBy('deck.downloadsCount', 'DESC');
        break;
      case DeckSortOrder.TITLE:
        qb.orderBy('deck.title', 'ASC');
        break;
      case DeckSortOrder.NEWEST:
      default:
        qb.orderBy('deck.createdAt', 'DESC');
        break;
    }
  }

  private deckQueryBuilder(): SelectQueryBuilder<Deck> {
    return this.deckRepository
      .createQueryBuilder('deck')
      .leftJoinAndSelect('deck.category', 'category')
      .leftJoinAndSelect('deck.author', 'author');
  }

  /**
   * TypeORM 1.x dropped `loadRelationCountAndMap` — the replacement pattern
   * is a correlated COUNT subquery via `addSelect`, read back via
   * `getRawAndEntities()` and merged onto each entity's transient
   * `cardCount` field (declared, undecorated, on the `Deck` entity).
   * `authorDisplayName`/`estimatedStudyMinutes` are cheap to add in the same
   * pass since `author` is already eager-joined above.
   */
  private async withComputedFields(
    qb: SelectQueryBuilder<Deck>,
  ): Promise<Deck[]> {
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
    entities.forEach((deck, index) => {
      deck.cardCount = Number(raw[index]?.cardCount ?? 0);
      deck.authorDisplayName = deck.author?.displayName ?? 'Unknown';
      deck.estimatedStudyMinutes = Math.max(
        1,
        deck.cardCount * ESTIMATED_MINUTES_PER_CARD,
      );
    });
    return entities;
  }
}
