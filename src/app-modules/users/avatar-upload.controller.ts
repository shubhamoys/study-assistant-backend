import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { unlink } from 'fs/promises';
import { extname, join, resolve } from 'path';
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
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

// Read directly from process.env, same reasoning as database/data-source.ts:
// multer's `storage` option is built once when this class is declared,
// before Nest's DI container exists, so there's no ConfigService to inject.
const AVATARS_DIR = resolve(
  process.env.LOCAL_STORAGE_PATH ?? './uploads',
  'avatars',
);
const AVATARS_URL_PREFIX = '/uploads/avatars/';

/**
 * The app's first REST endpoint (everything else is GraphQL) — a plain
 * multipart file upload has no good GraphQL-native story without adding a
 * separate multipart-spec client library on the frontend for one field, so
 * this stays a normal REST POST. Guarded by the same global JwtAuthGuard as
 * every resolver (see its getType() branch) — no @Public() here.
 */
@Controller('users/me/avatar')
export class AvatarUploadController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(AVATARS_DIR)) {
            mkdirSync(AVATARS_DIR, { recursive: true });
          }
          cb(null, AVATARS_DIR);
        },
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_AVATAR_BYTES },
      fileFilter: (_req, file, cb) => {
        cb(null, ALLOWED_MIME_TYPES.has(file.mimetype));
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: User,
  ): Promise<{ avatarUrl: string }> {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded, or file type/size not allowed (jpeg/png/webp, max 2MB)',
      );
    }

    const previousAvatarUrl = user.avatarUrl;
    const avatarUrl = `${AVATARS_URL_PREFIX}${file.filename}`;
    const updated = await this.usersService.update(user.id, { avatarUrl });

    // Best-effort cleanup of the file it's replacing — never block the
    // response on this.
    if (previousAvatarUrl?.startsWith(AVATARS_URL_PREFIX)) {
      const previousPath = join(
        AVATARS_DIR,
        previousAvatarUrl.slice(AVATARS_URL_PREFIX.length),
      );
      void unlink(previousPath).catch(() => {});
    }

    return { avatarUrl: updated.avatarUrl! };
  }
}
