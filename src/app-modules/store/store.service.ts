import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Flashcard } from '../study/entities/flashcard.entity';
import { Difficulty } from '../../database/enums';
import { Category } from './entities/category.entity';
import { Deck } from './entities/deck.entity';
import { DeckSortOrder } from './dto/deck-sort-order.enum';

// Minutes assumed per card for a first-pass study session — a simple,
// documented heuristic (see Deck.estimatedStudyMinutes), not a real
// per-deck-authored value (no deck-authoring UI exists yet).
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
