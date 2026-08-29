import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Deck } from './entities/deck.entity';
import { StoreResolver } from './store.resolver';
import { StoreService } from './store.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Deck])],
  providers: [StoreService, StoreResolver],
  exports: [StoreService],
})
export class StoreModule {}
