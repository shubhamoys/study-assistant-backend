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
import { Difficulty } from '../enums';
import { CardProgress } from './card-progress.entity';
import { Category } from './category.entity';
import { Flashcard } from './flashcard.entity';
import { Library } from './library.entity';
import { Review } from './review.entity';
import { StudySession } from './study-session.entity';
import { User } from './user.entity';

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

  @Column({ type: 'enum', enum: Difficulty, default: Difficulty.BEGINNER })
  difficulty!: Difficulty;

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

  @Index()
  @Column({ type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => Category, (category) => category.decks, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'categoryId' })
  category!: Category;

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
}
