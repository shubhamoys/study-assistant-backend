import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Flashcard } from '../study/entities/flashcard.entity';
import { Deck } from '../store/entities/deck.entity';
import { Library } from './entities/library.entity';

@Injectable()
export class LibraryService {
  constructor(
    @InjectRepository(Library)
    private readonly libraryRepository: Repository<Library>,
    @InjectRepository(Deck) private readonly deckRepository: Repository<Deck>,
  ) {}

  findForUser(userId: string): Promise<Library[]> {
    const qb = this.libraryQueryBuilder()
      .where('library.userId = :userId', { userId })
      .orderBy('library.createdAt', 'DESC');
    return this.withCardCount(qb);
  }

  async addDeck(userId: string, deckId: string): Promise<Library> {
    const deck = await this.deckRepository.findOneBy({
      id: deckId,
      isPublic: true,
    });
    if (!deck) {
      throw new NotFoundException('Deck not found');
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
    const qb = this.libraryQueryBuilder().where('library.id = :id', {
      id: saved.id,
    });
    const [entry] = await this.withCardCount(qb);
    return entry;
  }

  async removeDeck(userId: string, deckId: string): Promise<boolean> {
    const result = await this.libraryRepository.delete({ userId, deckId });
    if (!result.affected) {
      throw new NotFoundException('Deck not found in your library');
    }
    return true;
  }

  private libraryQueryBuilder(): SelectQueryBuilder<Library> {
    return this.libraryRepository
      .createQueryBuilder('library')
      .leftJoinAndSelect('library.deck', 'deck')
      .leftJoinAndSelect('deck.category', 'category');
  }

  /** Same correlated-COUNT-subquery pattern as StoreService — see its comment. */
  private async withCardCount(
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
    });
    return entities;
  }
}
