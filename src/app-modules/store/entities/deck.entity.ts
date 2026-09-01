import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Difficulty } from '../../../database/enums';
import { Review } from '../../reviews/entities/review.entity';
import { CardProgress } from '../../study/entities/card-progress.entity';
import { Flashcard } from '../../study/entities/flashcard.entity';
import { StudySession } from '../../study/entities/study-session.entity';
import { Category } from './category.entity';
import { Library } from '../../library/entities/library.entity';
import { User } from '../../users/entities/user.entity';

@Entity('decks')
@Index(['isPublic', 'isFree'])
export class Deck {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  coverUrl!: string | null;

  @Column({ default: false })
  isPublic!: boolean;

  /**
   * Nullable — required when this was the only deck-creation path, but a
   * custom/user-created deck no longer sets it (see the Phase 3 decision-log
   * entry). Still settable for public decks made through the admin panel.
   */
  @Column({ type: 'enum', enum: Difficulty, nullable: true })
  difficulty!: Difficulty | null;

  @Column({ default: true })
  isFree!: boolean;

  /** Lowest currency unit (cents / paise) — used from Phase 4 onward. */
  @Column({ type: 'int', default: 0 })
  price!: number;

  @Index()
  @Column({ type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => User, (user) => user.decksCreated, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author!: User;

  /** Nullable — optional for a custom/user-created deck (see the Phase 3 decision-log entry). */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  categoryId!: string | null;

  @ManyToOne(() => Category, (category) => category.decks, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'categoryId' })
  category!: Category | null;

  @Column({ type: 'int', default: 0 })
  downloadsCount!: number;

  @Column({ type: 'double precision', default: 0 })
  ratingAverage!: number;

  @Column({ type: 'int', default: 0 })
  ratingCount!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToMany(() => Flashcard, (flashcard) => flashcard.deck)
  flashcards!: Flashcard[];

  @OneToMany(() => Library, (library) => library.deck)
  libraryEntries!: Library[];

  @OneToMany(() => Review, (review) => review.deck)
  reviews!: Review[];

  @OneToMany(() => StudySession, (studySession) => studySession.deck)
  studySessions!: StudySession[];

  @OneToMany(() => CardProgress, (cardProgress) => cardProgress.deck)
  cardProgresses!: CardProgress[];

  /**
   * Not a real column — populated by the correlated-COUNT-subquery pattern
   * in StoreService/LibraryService (see their `withCardCount` methods;
   * TypeORM 1.x has no `loadRelationCountAndMap`). Undefined unless a query
   * explicitly maps it; declared here only so TS lets resolvers read it off
   * the entity instance the way GraphQL's default field resolution expects.
   */
  cardCount?: number;

  /** Same transient pattern as `cardCount` — read off the joined `author` relation by StoreService/LibraryService, not persisted. */
  authorDisplayName?: string;

  /** Same transient pattern as `cardCount` — a simple `cardCount * 2min` heuristic computed alongside it; no stored column (see DATABASE_DESIGN.md's note that this field was deliberately deferred until a screen actually needed it). */
  estimatedStudyMinutes?: number;
}
