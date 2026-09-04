import { User } from '../../app-modules/users/entities/user.entity';
import { RefreshToken } from '../../app-modules/auth/entities/refresh-token.entity';
import { Category } from '../../app-modules/store/entities/category.entity';
import { Deck } from '../../app-modules/store/entities/deck.entity';
import { Library } from '../../app-modules/library/entities/library.entity';
import { CardProgress } from '../../app-modules/study/entities/card-progress.entity';
import { Flashcard } from '../../app-modules/study/entities/flashcard.entity';
import { ReviewHistory } from '../../app-modules/study/entities/review-history.entity';
import { StudySession } from '../../app-modules/study/entities/study-session.entity';
import { Review } from '../../app-modules/reviews/entities/review.entity';
import { Attachment } from '../../app-modules/attachments/entities/attachment.entity';
import { CartItem } from '../../app-modules/cart/entities/cart-item.entity';
import { Order } from '../../app-modules/orders/entities/order.entity';
import { OrderItem } from '../../app-modules/orders/entities/order-item.entity';
import { Payment } from '../../app-modules/orders/entities/payment.entity';

/**
 * Registered with both the running app (TypeOrmModule) and the CLI DataSource.
 * `User`/`RefreshToken`/`Category`/`Deck`/`Library`/`CardProgress`/`Flashcard`/
 * `ReviewHistory`/`StudySession`/`Review`/`Attachment`/`CartItem`/`Order`/
 * `OrderItem`/`Payment` live in their owning app-modules — imported here
 * only to be listed for TypeORM; import the entity itself from its module,
 * not this barrel.
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
  CartItem,
  Order,
  OrderItem,
  Payment,
];
