import { Attachment } from './attachment.entity';
import { CardProgress } from './card-progress.entity';
import { Category } from './category.entity';
import { Deck } from './deck.entity';
import { Flashcard } from './flashcard.entity';
import { Library } from './library.entity';
import { RefreshToken } from './refresh-token.entity';
import { Review } from './review.entity';
import { ReviewHistory } from './review-history.entity';
import { StudySession } from './study-session.entity';
import { User } from './user.entity';

export {
  Attachment,
  CardProgress,
  Category,
  Deck,
  Flashcard,
  Library,
  RefreshToken,
  Review,
  ReviewHistory,
  StudySession,
  User,
};

/** Registered with both the running app (TypeOrmModule) and the CLI DataSource. */
export const entities = [
  User,
  RefreshToken,
  Category,
  Deck,
  Flashcard,
  Library,
  StudySession,
  CardProgress,
  ReviewHistory,
  Review,
  Attachment,
];
