import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deck } from '../store/entities/deck.entity';
import { Review } from './entities/review.entity';
import { ReviewsResolver } from './reviews.resolver';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Deck])],
  providers: [ReviewsService, ReviewsResolver],
})
export class ReviewsModule {}
