import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Flashcard } from './flashcard.entity';
import { User } from './user.entity';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  flashcardId!: string | null;

  @ManyToOne(() => Flashcard, (flashcard) => flashcard.attachments, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'flashcardId' })
  flashcard!: Flashcard | null;

  @Column({ type: 'varchar', length: 512 })
  url!: string;

  @Column({ type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ type: 'int' })
  fileSize!: number;

  @Column({ type: 'varchar', length: 100 })
  mimeType!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
