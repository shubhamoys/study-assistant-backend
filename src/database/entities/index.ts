import { User } from '../../app-modules/users/entities/user.entity';
import { Category } from '../../app-modules/store/entities/category.entity';
import { Deck } from '../../app-modules/store/entities/deck.entity';
import { Library } from '../../app-modules/library/entities/library.entity';
import { CardProgress } from '../../app-modules/study/entities/card-progress.entity';
import { Flashcard } from '../../app-modules/study/entities/flashcard.entity';
import { ReviewHistory } from '../../app-modules/study/entities/review-history.entity';
import { StudySession } from '../../app-modules/study/entities/study-session.entity';
import { Attachment } from './attachment.entity';
import { RefreshToken } from './refresh-token.entity';
import { Review } from './review.entity';

export { Attachment, RefreshToken, Review };

/**
 * Registered with both the running app (TypeOrmModule) and the CLI DataSource.
 * `User`/`Category`/`Deck`/`Library`/`CardProgress`/`Flashcard`/`ReviewHistory`/
 * `StudySession` live in their owning app-modules — imported here only to be
 * listed for TypeORM; import the entity itself from its module, not this barrel.
 */
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
