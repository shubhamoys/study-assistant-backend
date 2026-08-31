import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment } from './entities/attachment.entity';

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
  ) {}

  create(
    userId: string,
    data: { url: string; fileName: string; fileSize: number; mimeType: string },
  ): Promise<Attachment> {
    return this.attachmentRepository.save(
      // flashcardId stays null — this is a standalone upload (the editor
      // needs a URL back before the flashcard/deck it's embedded in has
      // even been saved yet). See attachments.module.ts's doc comment.
      this.attachmentRepository.create({ userId, flashcardId: null, ...data }),
    );
  }
}
