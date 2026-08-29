import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Library } from '../library/entities/library.entity';
import { CardProgress } from './entities/card-progress.entity';
import { Flashcard } from './entities/flashcard.entity';
import { ReviewHistory } from './entities/review-history.entity';
import { StudySession } from './entities/study-session.entity';
import { StudyResolver } from './study.resolver';
import { StudyService } from './study.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Flashcard,
      CardProgress,
      StudySession,
      ReviewHistory,
      Library,
    ]),
  ],
  providers: [StudyService, StudyResolver],
})
export class StudyModule {}
