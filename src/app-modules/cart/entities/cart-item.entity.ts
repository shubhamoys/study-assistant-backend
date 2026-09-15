import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Deck } from '../../store/entities/deck.entity';
import { User } from '../../users/entities/user.entity';

/**
 * A user's server-persisted cart, one row per deck — deliberately not
 * storing a price snapshot (unlike `OrderItem`, which will when Phase 4
 * checkpoint 2 builds checkout): the cart always reflects the deck's
 * *current* price until checkout captures it, so an admin price change
 * before checkout is honored rather than silently ignored.
 */
@Entity('cart_items')
@Unique(['userId', 'deckId'])
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.cartItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  deckId!: string;

  @ManyToOne(() => Deck, (deck) => deck.cartItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deckId' })
  deck!: Deck;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
