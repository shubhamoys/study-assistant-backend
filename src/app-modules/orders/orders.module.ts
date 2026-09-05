import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Flashcard } from '../study/entities/flashcard.entity';
import { CouponsResolver } from './coupons.resolver';
import { CouponsService } from './coupons.service';
import { Coupon } from './entities/coupon.entity';
import { Order } from './entities/order.entity';
import { OrdersResolver } from './orders.resolver';
import { OrdersService } from './orders.service';

// Order/Flashcard/CartItem/Coupon are the only entities ever
// @InjectRepository()'d directly (see OrdersService/CouponsService) —
// checkout's transaction reaches Library/Deck/OrderItem/Payment through the
// transactional EntityManager instead, which already has access to every
// entity registered in the app-wide TypeOrmModule.forRoot(...) connection;
// forFeature here only needs to list what this module's own providers inject.
@Module({
  imports: [TypeOrmModule.forFeature([Order, Flashcard, CartItem, Coupon])],
  providers: [OrdersService, OrdersResolver, CouponsService, CouponsResolver],
})
export class OrdersModule {}
