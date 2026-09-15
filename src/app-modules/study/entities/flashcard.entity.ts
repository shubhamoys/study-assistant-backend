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
import { Attachment } from '../../attachments/entities/attachment.entity';
import { CardProgress } from './card-progress.entity';
import { ReviewHistory } from './review-history.entity';
import { Deck } from '../../store/entities/deck.entity';

@Entity('flashcards')
@Index(['deckId', 'orderIndex'])
export class Flashcard {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  deckId!: string;

  @ManyToOne(() => Deck, (deck) => deck.flashcards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deckId' })
  deck!: Deck;

  @Column({ type: 'text' })
  front!: string;

  @Column({ type: 'text' })
  back!: string;

  @Column({ type: 'int' })
  orderIndex!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToMany(() => ReviewHistory, (reviewHistory) => reviewHistory.card)
  reviews!: ReviewHistory[];

  @OneToMany(() => CardProgress, (cardProgress) => cardProgress.card)
  progresses!: CardProgress[];

  @OneToMany(() => Attachment, (attachment) => attachment.flashcard)
  attachments!: Attachment[];
}
