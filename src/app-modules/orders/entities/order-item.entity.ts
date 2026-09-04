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
import { Deck } from '../../store/entities/deck.entity';
import { Order } from './order.entity';

/**
 * `price` is captured at checkout time — deliberately the only place in
 * this codebase a deck's price gets snapshotted (the Cart, by contrast,
 * always shows the deck's *live* current price; see the Phase 4 checkpoint
 * 1 decision log). An admin changing a deck's price later never rewrites
 * history for an order that already happened.
 */
@Entity('order_items')
@Unique(['orderId', 'deckId'])
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order!: Order;

  @Column({ type: 'uuid' })
  deckId!: string;

  // RESTRICT, not CASCADE — a purchased deck's order history must survive
  // even if the deck itself is later soft-deleted (deletedAt), and the FK
  // would only ever fire on a real hard delete, which this codebase never
  // does to a Deck.
  @ManyToOne(() => Deck, (deck) => deck.orderItems, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'deckId' })
  deck!: Deck;

  @Column({ type: 'int' })
  price!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
