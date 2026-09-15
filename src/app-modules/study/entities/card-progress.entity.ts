import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { FSRSState } from '../../../database/enums';
import { Flashcard } from './flashcard.entity';
import { Deck } from '../../store/entities/deck.entity';
import { User } from '../../users/entities/user.entity';

@Entity('card_progress')
@Unique(['userId', 'cardId'])
@Index(['userId', 'dueAt'])
@Index(['userId', 'deckId', 'dueAt'])
export class CardProgress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.cardProgresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  cardId!: string;

  @ManyToOne(() => Flashcard, (flashcard) => flashcard.progresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cardId' })
  card!: Flashcard;

  /** Denormalized from Flashcard.deckId — lets the study queue be fetched with zero joins. */
  @Column({ type: 'uuid' })
  deckId!: string;

  @ManyToOne(() => Deck, (deck) => deck.cardProgresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'deckId' })
  deck!: Deck;

  @Column({ type: 'enum', enum: FSRSState, default: FSRSState.NEW })
  state!: FSRSState;

  @Column({ type: 'double precision', default: 0 })
  stability!: number;

  @Column({ type: 'double precision', default: 0 })
  difficulty!: number;

  @Column({ type: 'int', default: 0 })
  elapsedDays!: number;

  @Column({ type: 'int', default: 0 })
  scheduledDays!: number;

  /**
   * Index into ts-fsrs's (re)learning step sequence — required by the
   * library's `Card` shape (not in the original DATABASE_DESIGN.md spec,
   * added when wiring up FSRS for checkpoint 3) so a partially-completed
   * learning/relearning sequence (e.g. the [1m, 10m] default steps) resumes
   * correctly across separate `submitCardReview` calls instead of restarting.
   */
  @Column({ type: 'int', default: 0 })
  learningSteps!: number;

  @Column({ type: 'int', default: 0 })
  reps!: number;

  @Column({ type: 'int', default: 0 })
  lapses!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastReviewedAt!: Date | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  dueAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
