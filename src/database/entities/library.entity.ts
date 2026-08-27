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
import { Deck } from './deck.entity';
import { User } from '../../app-modules/users/entities/user.entity';

@Entity('library')
@Unique(['userId', 'deckId'])
export class Library {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.libraryEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  deckId!: string;

  @ManyToOne(() => Deck, (deck) => deck.libraryEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'deckId' })
  deck!: Deck;

  @Column({ type: 'timestamptz', nullable: true })
  lastStudiedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
