import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flashcard } from '../study/entities/flashcard.entity';
import { Order } from './entities/order.entity';
import { OrdersResolver } from './orders.resolver';
import { OrdersService } from './orders.service';

// Only Order and Flashcard are ever @InjectRepository()'d directly (see
// OrdersService) — checkout's transaction reaches CartItem/Library/Deck/
// OrderItem/Payment through the transactional EntityManager instead, which
// already has access to every entity registered in the app-wide
// TypeOrmModule.forRoot(...) connection; forFeature here only needs to
// list what this module's own providers inject.
@Module({
  imports: [TypeOrmModule.forFeature([Order, Flashcard])],
  providers: [OrdersService, OrdersResolver],
})
export class OrdersModule {}
