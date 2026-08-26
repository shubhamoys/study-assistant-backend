import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../enums';
import { Attachment } from './attachment.entity';
import { CardProgress } from './card-progress.entity';
import { Deck } from './deck.entity';
import { Library } from './library.entity';
import { RefreshToken } from './refresh-token.entity';
import { Review } from './review.entity';
import { ReviewHistory } from './review-history.entity';
import { StudySession } from './study-session.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ default: false })
  isEmailVerified!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  displayName!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  verificationToken!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resetPasswordToken!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resetPasswordExpires!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  refreshTokens!: RefreshToken[];

  @OneToMany(() => Deck, (deck) => deck.author)
  decksCreated!: Deck[];

  @OneToMany(() => Library, (library) => library.user)
  libraryEntries!: Library[];

  @OneToMany(() => Review, (review) => review.user)
  reviews!: Review[];

  @OneToMany(() => StudySession, (studySession) => studySession.user)
  studySessions!: StudySession[];

  @OneToMany(() => ReviewHistory, (reviewHistory) => reviewHistory.user)
  reviewHistories!: ReviewHistory[];

  @OneToMany(() => CardProgress, (cardProgress) => cardProgress.user)
  cardProgresses!: CardProgress[];

  @OneToMany(() => Attachment, (attachment) => attachment.user)
  attachments!: Attachment[];
}
