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
import { UserRole } from '../../../database/enums';
import { Attachment } from '../../../database/entities/attachment.entity';
import { Review } from '../../../database/entities/review.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { Deck } from '../../store/entities/deck.entity';
import { Library } from '../../library/entities/library.entity';
import { CardProgress } from '../../study/entities/card-progress.entity';
import { ReviewHistory } from '../../study/entities/review-history.entity';
import { StudySession } from '../../study/entities/study-session.entity';

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

  // Set each time resendVerificationEmail is called (not on the initial
  // registration email) — lets the resolver enforce a cooldown server-side
  // even if the client refreshes or has stale local state.
  @Column({ type: 'timestamptz', nullable: true })
  verificationEmailSentAt!: Date | null;

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
