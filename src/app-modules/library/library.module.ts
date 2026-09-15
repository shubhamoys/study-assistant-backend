import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deck } from '../store/entities/deck.entity';
import { Library } from './entities/library.entity';
import { LibraryResolver } from './library.resolver';
import { LibraryService } from './library.service';

@Module({
  imports: [TypeOrmModule.forFeature([Library, Deck])],
  providers: [LibraryService, LibraryResolver],
})
export class LibraryModule {}
