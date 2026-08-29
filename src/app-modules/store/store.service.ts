import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Flashcard } from '../study/entities/flashcard.entity';
import { Category } from './entities/category.entity';
import { Deck } from './entities/deck.entity';

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

  async findDecks(categoryId?: string): Promise<Deck[]> {
    const qb = this.deckQueryBuilder().where('deck.isPublic = true');
    if (categoryId) {
      qb.andWhere('deck.categoryId = :categoryId', { categoryId });
    }
    qb.orderBy('deck.createdAt', 'DESC');
    return this.withCardCount(qb);
  }

  async findDeckById(id: string): Promise<Deck> {
    const qb = this.deckQueryBuilder()
      .where('deck.id = :id', { id })
      .andWhere('deck.isPublic = true');
    const [deck] = await this.withCardCount(qb);
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }
    return deck;
  }

  private deckQueryBuilder(): SelectQueryBuilder<Deck> {
    return this.deckRepository
      .createQueryBuilder('deck')
      .leftJoinAndSelect('deck.category', 'category');
  }

  /**
   * TypeORM 1.x dropped `loadRelationCountAndMap` — the replacement pattern
   * is a correlated COUNT subquery via `addSelect`, read back via
   * `getRawAndEntities()` and merged onto each entity's transient
   * `cardCount` field (declared, undecorated, on the `Deck` entity).
   */
  private async withCardCount(qb: SelectQueryBuilder<Deck>): Promise<Deck[]> {
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
    });
    return entities;
  }
}
