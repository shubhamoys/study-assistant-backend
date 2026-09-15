import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { extname, resolve } from 'path';
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AttachmentsService } from './attachments.service';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB — larger than avatars (2MB), for content images

// Same reasoning as avatar-upload.controller.ts: multer's `storage` option
// is built once when this class is declared, before Nest's DI container
// exists, so read the storage path directly from process.env here.
const ATTACHMENTS_DIR = resolve(
  process.env.LOCAL_STORAGE_PATH ?? './uploads',
  'attachments',
);
const ATTACHMENTS_URL_PREFIX = '/uploads/attachments/';

/**
 * Second REST route in the app (after avatar upload) — same reasoning:
 * multipart file upload doesn't fit GraphQL well. Used for both flashcard
 * content images (inserted as markdown `![alt](url)`) and deck cover images
 * (`Deck.coverUrl` set directly to the returned url) — one upload primitive,
 * the caller decides what to do with the URL it gets back.
 */
@Controller('attachments')
export class AttachmentUploadController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(ATTACHMENTS_DIR)) {
            mkdirSync(ATTACHMENTS_DIR, { recursive: true });
          }
          cb(null, ATTACHMENTS_DIR);
        },
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_ATTACHMENT_BYTES },
      fileFilter: (_req, file, cb) => {
        cb(null, ALLOWED_MIME_TYPES.has(file.mimetype));
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: User,
  ): Promise<{ id: string; url: string }> {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded, or file type/size not allowed (jpeg/png/webp/gif, max 5MB)',
      );
    }

    const attachment = await this.attachmentsService.create(user.id, {
      url: `${ATTACHMENTS_URL_PREFIX}${file.filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    });

    return { id: attachment.id, url: attachment.url };
  }
}
