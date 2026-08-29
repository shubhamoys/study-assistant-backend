import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { User } from '../src/app-modules/users/entities/user.entity';

interface GraphQLResponse<T> {
  body: {
    data: T | null;
    errors?: { message: string; extensions?: { code?: string } }[];
  };
}

const TEST_EMAIL = 'e2e-account-test@example.com';
const TEST_PASSWORD = 'password123';
const AVATARS_DIR = join(
  process.env.LOCAL_STORAGE_PATH ?? './uploads',
  'avatars',
);

function gql(query: string) {
  return { query };
}

// A tiny valid 1x1 PNG (transparent), just enough to satisfy the multer
// fileFilter's mimetype check and give Sharp/the browser something real to
// decode — content doesn't matter beyond "this is actually a PNG".
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('Account (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Only the avatar-upload REST route needs this — GraphQL registers its
    // route directly and is unaffected. main.ts sets this in bootstrap(),
    // which the e2e harness never calls (same reason app.module.ts's
    // ValidationPipe is registered via APP_PIPE instead of imperatively).
    app.setGlobalPrefix(
      moduleFixture.get(ConfigService).get<string>('app.apiPrefix')!,
    );
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    await userRepository.delete({ email: TEST_EMAIL });

    const registerRes: {
      body: { data: { register: { accessToken: string } } };
    } = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}" }) { accessToken } }`,
        ),
      );
    accessToken = registerRes.body.data.register.accessToken;
  });

  afterAll(async () => {
    const user = await userRepository.findOneBy({ email: TEST_EMAIL });
    if (user?.avatarUrl?.startsWith('/uploads/avatars/')) {
      const filePath = join(
        AVATARS_DIR,
        user.avatarUrl.replace('/uploads/avatars/', ''),
      );
      if (existsSync(filePath)) rmSync(filePath);
    }
    await userRepository.delete({ email: TEST_EMAIL });
    await app.close();
  });

  describe('updateProfile', () => {
    it('updates the display name', async () => {
      const res: GraphQLResponse<{ updateProfile: { displayName: string } }> =
        await request(app.getHttpServer())
          .post('/graphql')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(
            gql(
              `mutation { updateProfile(input: { displayName: "Ada Lovelace" }) { displayName } }`,
            ),
          );

      expect(res.body.data?.updateProfile.displayName).toBe('Ada Lovelace');
    });

    it('rejects an empty display name', async () => {
      const res: GraphQLResponse<null> = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(
          gql(
            `mutation { updateProfile(input: { displayName: "" }) { displayName } }`,
          ),
        );

      expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
    });

    it('requires auth', async () => {
      const res: GraphQLResponse<null> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { updateProfile(input: { displayName: "Nope" }) { displayName } }`,
          ),
        );

      expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('POST /api/users/me/avatar', () => {
    it('rejects an unauthenticated upload', async () => {
      await request(app.getHttpServer())
        .post('/api/users/me/avatar')
        .attach('file', TINY_PNG, 'avatar.png')
        .expect(401);
    });

    it('rejects a non-image file', async () => {
      const res: { body: { message: string } } = await request(
        app.getHttpServer(),
      )
        .post('/api/users/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('not an image'), 'notes.txt')
        .expect(400);

      expect(res.body.message).toMatch(/file type\/size not allowed/);
    });

    it('uploads an avatar and reflects it on `me`, replacing the old file on re-upload', async () => {
      const uploadRes: { body: { avatarUrl: string } } = await request(
        app.getHttpServer(),
      )
        .post('/api/users/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', TINY_PNG, 'avatar.png')
        .expect(201);

      const firstUrl = uploadRes.body.avatarUrl;
      expect(firstUrl).toMatch(/^\/uploads\/avatars\/.+\.png$/);

      const meRes: GraphQLResponse<{ me: { avatarUrl: string } }> =
        await request(app.getHttpServer())
          .post('/graphql')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(gql(`{ me { avatarUrl } }`));
      expect(meRes.body.data?.me.avatarUrl).toBe(firstUrl);

      const firstFilePath = join(
        AVATARS_DIR,
        firstUrl.replace('/uploads/avatars/', ''),
      );
      expect(existsSync(firstFilePath)).toBe(true);

      // Re-upload — the old file should be cleaned up, not left orphaned.
      const secondRes: { body: { avatarUrl: string } } = await request(
        app.getHttpServer(),
      )
        .post('/api/users/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', TINY_PNG, 'avatar2.png')
        .expect(201);

      const secondUrl = secondRes.body.avatarUrl;
      expect(secondUrl).not.toBe(firstUrl);
      expect(existsSync(firstFilePath)).toBe(false);
    });
  });
});
