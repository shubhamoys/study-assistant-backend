import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating as FsrsRating, fsrs, type Grade } from 'ts-fsrs';
import { FSRSState } from '../../database/enums';
import { Library } from '../library/entities/library.entity';
import { CardReviewResultType } from './dto/card-review-result.type';
import { NextCardType, RatingPreviewType } from './dto/next-card.type';
import { StudyQueueType } from './dto/study-queue.type';
import { SubmitCardReviewInput } from './dto/submit-card-review.input';
import { CardProgress } from './entities/card-progress.entity';
import { Flashcard } from './entities/flashcard.entity';
import { ReviewHistory } from './entities/review-history.entity';
import { StudySession } from './entities/study-session.entity';
import {
  applyFsrsCard,
  formatIntervalLabel,
  ratingToGrade,
  toFsrsCard,
} from './fsrs.util';

const scheduler = fsrs();

@Injectable()
export class StudyService {
  constructor(
    @InjectRepository(Flashcard)
    private readonly flashcardRepository: Repository<Flashcard>,
    @InjectRepository(CardProgress)
    private readonly cardProgressRepository: Repository<CardProgress>,
    @InjectRepository(StudySession)
    private readonly studySessionRepository: Repository<StudySession>,
    @InjectRepository(ReviewHistory)
    private readonly reviewHistoryRepository: Repository<ReviewHistory>,
    @InjectRepository(Library)
    private readonly libraryRepository: Repository<Library>,
  ) {}

  async getStudyQueue(userId: string, deckId: string): Promise<StudyQueueType> {
    await this.assertInLibrary(userId, deckId);
    const now = new Date();

    const dueCount = await this.cardProgressRepository
      .createQueryBuilder('progress')
      .innerJoin('progress.card', 'card')
      .where('progress.userId = :userId', { userId })
      .andWhere('progress.deckId = :deckId', { deckId })
      .andWhere('progress.dueAt <= :now', { now })
      .andWhere('card.deletedAt IS NULL')
      .getCount();

    const newCount = await this.newFlashcardsQueryBuilder(
      userId,
      deckId,
    ).getCount();

    return { deckId, dueCount, newCount, totalCount: dueCount + newCount };
  }

  async getNextCard(
    userId: string,
    deckId: string,
  ): Promise<NextCardType | null> {
    await this.assertInLibrary(userId, deckId);
    const now = new Date();

    const dueProgress = await this.findDueCardProgress(userId, deckId, now);
    const flashcard =
      dueProgress?.card ??
      (await this.newFlashcardsQueryBuilder(userId, deckId).getOne());
    if (!flashcard) {
      return null;
    }

    const fsrsCard = toFsrsCard(dueProgress, now);
    const outcomes = scheduler.repeat(fsrsCard, now);
    const preview = (grade: Grade): RatingPreviewType => {
      const { card } = outcomes[grade];
      return {
        intervalLabel: formatIntervalLabel(card.due, now),
        dueAt: card.due,
      };
    };

    return {
      cardId: flashcard.id,
      front: flashcard.front,
      back: flashcard.back,
      again: preview(FsrsRating.Again),
      hard: preview(FsrsRating.Hard),
      good: preview(FsrsRating.Good),
      easy: preview(FsrsRating.Easy),
    };
  }

  async submitCardReview(
    userId: string,
    input: SubmitCardReviewInput,
  ): Promise<CardReviewResultType> {
    const { deckId, cardId, rating, sessionId } = input;
    await this.assertInLibrary(userId, deckId);

    const flashcard = await this.flashcardRepository.findOneBy({
      id: cardId,
      deckId,
    });
    if (!flashcard) {
      throw new NotFoundException('Card not found');
    }

    let progress = await this.cardProgressRepository.findOneBy({
      userId,
      cardId,
    });
    const now = new Date();
    const stateBefore = progress?.state ?? FSRSState.NEW;

    const grade = ratingToGrade(rating);
    const { card: fsrsCardAfter, log } = scheduler.next(
      toFsrsCard(progress, now),
      now,
      grade,
    );

    const session = await this.getOrCreateSession(userId, deckId, sessionId);

    if (!progress) {
      progress = this.cardProgressRepository.create({ userId, cardId, deckId });
    }
    applyFsrsCard(progress, fsrsCardAfter);
    progress.lastReviewedAt = now;
    await this.cardProgressRepository.save(progress);

    await this.reviewHistoryRepository.save(
      this.reviewHistoryRepository.create({
        userId,
        cardId,
        sessionId: session.id,
        rating,
        state: stateBefore,
        stability: fsrsCardAfter.stability,
        difficulty: fsrsCardAfter.difficulty,
        // `log.elapsed_days` is deprecated upstream (removal planned for
        // ts-fsrs v6) but is what's actually populated in the installed
        // v5.x — re-check this mapping if ts-fsrs is ever upgraded past 6.0.
        elapsedDays: log.elapsed_days,
        scheduledDays: fsrsCardAfter.scheduled_days,
      }),
    );

    session.cardsReviewed += 1;
    await this.studySessionRepository.save(session);

    return {
      sessionId: session.id,
      cardId,
      state: progress.state,
      dueAt: progress.dueAt,
      stability: progress.stability,
      difficulty: progress.difficulty,
    };
  }

  async completeStudySession(
    userId: string,
    sessionId: string,
  ): Promise<boolean> {
    const session = await this.studySessionRepository.findOneBy({
      id: sessionId,
      userId,
    });
    if (!session) {
      throw new NotFoundException('Study session not found');
    }
    session.endedAt = new Date();
    await this.studySessionRepository.save(session);
    return true;
  }

  private async getOrCreateSession(
    userId: string,
    deckId: string,
    sessionId?: string,
  ): Promise<StudySession> {
    if (sessionId) {
      const existing = await this.studySessionRepository.findOneBy({
        id: sessionId,
        userId,
        deckId,
      });
      if (!existing) {
        throw new NotFoundException('Study session not found');
      }
      return existing;
    }
    return this.studySessionRepository.save(
      this.studySessionRepository.create({ userId, deckId }),
    );
  }

  private async findDueCardProgress(
    userId: string,
    deckId: string,
    now: Date,
  ): Promise<CardProgress | null> {
    return this.cardProgressRepository
      .createQueryBuilder('progress')
      .innerJoinAndSelect('progress.card', 'card')
      .where('progress.userId = :userId', { userId })
      .andWhere('progress.deckId = :deckId', { deckId })
      .andWhere('progress.dueAt <= :now', { now })
      .andWhere('card.deletedAt IS NULL')
      .orderBy('progress.dueAt', 'ASC')
      .getOne();
  }

  /** Flashcards in the deck with no `CardProgress` row yet for this user, in deck order. */
  private newFlashcardsQueryBuilder(userId: string, deckId: string) {
    return this.flashcardRepository
      .createQueryBuilder('flashcard')
      .leftJoin(
        CardProgress,
        'progress',
        'progress.cardId = flashcard.id AND progress.userId = :userId',
        { userId },
      )
      .where('flashcard.deckId = :deckId', { deckId })
      .andWhere('flashcard.deletedAt IS NULL')
      .andWhere('progress.id IS NULL')
      .orderBy('flashcard.orderIndex', 'ASC');
  }

  private async assertInLibrary(userId: string, deckId: string): Promise<void> {
    const entry = await this.libraryRepository.findOneBy({ userId, deckId });
    if (!entry) {
      throw new NotFoundException(
        'Add this deck to your library before studying it',
      );
    }
  }
}
