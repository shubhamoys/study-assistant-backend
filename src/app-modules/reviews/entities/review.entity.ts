import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Deck } from '../../store/entities/deck.entity';
import { User } from '../../users/entities/user.entity';

@Entity('reviews')
@Unique(['userId', 'deckId'])
@Check(`"rating" >= 1 AND "rating" <= 5`)
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index()
  @Column({ type: 'uuid' })
  deckId!: string;

  @ManyToOne(() => Deck, (deck) => deck.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deckId' })
  deck!: Deck;

  @Column({ type: 'int' })
  rating!: number;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  /**
   * Not real columns — populated by `ReviewsService` from the joined `user`
   * relation, the same transient-field pattern `Deck.cardCount` already
   * uses. `ReviewType` flattens these onto the review directly rather than
   * exposing a nested `UserType`, so declared here (undecorated, so TypeORM
   * ignores them for persistence/migrations) purely so GraphQL's
   * default-field-resolution-by-property-name can read them off the entity.
   */
  authorDisplayName?: string;
  authorAvatarUrl?: string | null;
}
