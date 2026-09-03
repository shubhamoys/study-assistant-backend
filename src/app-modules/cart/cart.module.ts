import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deck } from '../store/entities/deck.entity';
import { CartItem } from './entities/cart-item.entity';
import { CartResolver } from './cart.resolver';
import { CartService } from './cart.service';

@Module({
  imports: [TypeOrmModule.forFeature([CartItem, Deck])],
  providers: [CartService, CartResolver],
})
export class CartModule {}
