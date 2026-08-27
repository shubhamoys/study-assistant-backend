import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FSRSState, Rating } from '../enums';
import { Flashcard } from './flashcard.entity';
import { StudySession } from './study-session.entity';
import { User } from '../../app-modules/users/entities/user.entity';

@Entity('review_history')
@Index(['userId', 'cardId'])
export class ReviewHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.reviewHistories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  cardId!: string;

  @ManyToOne(() => Flashcard, (flashcard) => flashcard.reviews, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cardId' })
  card!: Flashcard;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  sessionId!: string | null;

  @ManyToOne(() => StudySession, (studySession) => studySession.reviews, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'sessionId' })
  session!: StudySession | null;

  @Column({ type: 'enum', enum: Rating })
  rating!: Rating;

  /** FSRS state *before* this review. */
  @Column({ type: 'enum', enum: FSRSState })
  state!: FSRSState;

  /** FSRS stability *after* this review. */
  @Column({ type: 'double precision' })
  stability!: number;

  /** FSRS difficulty *after* this review. */
  @Column({ type: 'double precision' })
  difficulty!: number;

  @Column({ type: 'int' })
  elapsedDays!: number;

  @Column({ type: 'int' })
  scheduledDays!: number;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
