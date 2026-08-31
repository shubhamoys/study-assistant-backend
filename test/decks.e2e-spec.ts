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
import { Deck } from '../src/app-modules/store/entities/deck.entity';
import { Category } from '../src/app-modules/store/entities/category.entity';
import { Attachment } from '../src/app-modules/attachments/entities/attachment.entity';

interface GraphQLResponse<T> {
  body: {
    data: T | null;
    errors?: { message: string; extensions?: { code?: string } }[];
  };
}

const TEST_EMAIL_A = 'e2e-decks-test-a@example.com';
const TEST_EMAIL_B = 'e2e-decks-test-b@example.com';
const TEST_PASSWORD = 'password123';
const ATTACHMENTS_DIR = join(
  process.env.LOCAL_STORAGE_PATH ?? './uploads',
  'attachments',
);

// A tiny valid 1x1 PNG, same fixture as account.e2e-spec.ts's avatar tests.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function gql(query: string) {
  return { query };
}

describe('Decks (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let deckRepository: Repository<Deck>;
  let categoryRepository: Repository<Category>;
  let attachmentRepository: Repository<Attachment>;
  let tokenA: string;
  let tokenB: string;
  let categoryId: string;
  const uploadedAttachmentPaths: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(
      moduleFixture.get(ConfigService).get<string>('app.apiPrefix')!,
    );
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    deckRepository = moduleFixture.get(getRepositoryToken(Deck));
    categoryRepository = moduleFixture.get(getRepositoryToken(Category));
    attachmentRepository = moduleFixture.get(getRepositoryToken(Attachment));
    await userRepository.delete({ email: TEST_EMAIL_A });
    await userRepository.delete({ email: TEST_EMAIL_B });

    const registerA: GraphQLResponse<{ register: { accessToken: string } }> =
      await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { register(input: { email: "${TEST_EMAIL_A}", password: "${TEST_PASSWORD}", displayName: "Deck Author" }) { accessToken } }`,
          ),
        );
    tokenA = registerA.body.data!.register.accessToken;

    const registerB: GraphQLResponse<{ register: { accessToken: string } }> =
      await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { register(input: { email: "${TEST_EMAIL_B}", password: "${TEST_PASSWORD}", displayName: "Other User" }) { accessToken } }`,
          ),
        );
    tokenB = registerB.body.data!.register.accessToken;

    const [category] = await categoryRepository.find({ take: 1 });
    categoryId = category.id;
  });

  afterAll(async () => {
    const userA = await userRepository.findOneBy({ email: TEST_EMAIL_A });
    if (userA) {
      await deckRepository.delete({ authorId: userA.id });
      await attachmentRepository.delete({ userId: userA.id });
    }
    for (const path of uploadedAttachmentPaths) {
      if (existsSync(path)) rmSync(path);
    }
    await userRepository.delete({ email: TEST_EMAIL_A });
    await userRepository.delete({ email: TEST_EMAIL_B });
    await app.close();
  });

  function authedAs(token: string, query: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql(query));
  }

  describe('createDeck / updateDeck / deleteDeck', () => {
    let deckId: string;

    it('creates a deck owned by the current user', async () => {
      const res: GraphQLResponse<{
        createDeck: {
          id: string;
          title: string;
          authorId: string;
          isFree: boolean;
          price: number;
        };
      }> = await authedAs(
        tokenA,
        `mutation { createDeck(input: { title: "E2E Test Deck", description: "A deck", categoryId: "${categoryId}", difficulty: BEGINNER }) { id title authorId isFree price } }`,
      );

      expect(res.body.data!.createDeck.title).toBe('E2E Test Deck');
      expect(res.body.data!.createDeck.isFree).toBe(true);
      expect(res.body.data!.createDeck.price).toBe(0);
      deckId = res.body.data!.createDeck.id;
    });

    it('rejects an empty title', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        tokenA,
        `mutation { createDeck(input: { title: "", categoryId: "${categoryId}", difficulty: BEGINNER }) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
    });

    it('lists the deck via myDecks', async () => {
      const res: GraphQLResponse<{ myDecks: { id: string }[] }> =
        await authedAs(tokenA, `{ myDecks { id } }`);
      expect(res.body.data!.myDecks.some((d) => d.id === deckId)).toBe(true);
    });

    it("rejects updating another user's deck", async () => {
      const res: GraphQLResponse<null> = await authedAs(
        tokenB,
        `mutation { updateDeck(id: "${deckId}", input: { title: "Hijacked" }) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });

    it('updates own deck', async () => {
      const res: GraphQLResponse<{ updateDeck: { title: string } }> =
        await authedAs(
          tokenA,
          `mutation { updateDeck(id: "${deckId}", input: { title: "Renamed Deck" }) { title } }`,
        );
      expect(res.body.data!.updateDeck.title).toBe('Renamed Deck');
    });

    it("rejects deleting another user's deck", async () => {
      const res: GraphQLResponse<null> = await authedAs(
        tokenB,
        `mutation { deleteDeck(id: "${deckId}") }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });

    it('deletes own deck (soft delete) and it disappears from decks/myDecks', async () => {
      const res: GraphQLResponse<{ deleteDeck: boolean }> = await authedAs(
        tokenA,
        `mutation { deleteDeck(id: "${deckId}") }`,
      );
      expect(res.body.data!.deleteDeck).toBe(true);

      const myDecksRes: GraphQLResponse<{ myDecks: { id: string }[] }> =
        await authedAs(tokenA, `{ myDecks { id } }`);
      expect(myDecksRes.body.data!.myDecks.some((d) => d.id === deckId)).toBe(
        false,
      );

      const deckRes: GraphQLResponse<null> = await authedAs(
        tokenA,
        `{ deck(id: "${deckId}") { id } }`,
      );
      expect(deckRes.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');

      const rawDeck = await deckRepository.findOne({
        where: { id: deckId },
        withDeleted: true,
      });
      expect(rawDeck?.deletedAt).not.toBeNull();
    });
  });

  describe('createFlashcard / updateFlashcard / deleteFlashcard', () => {
    let deckId: string;
    let flashcardId: string;

    beforeAll(async () => {
      const res: GraphQLResponse<{ createDeck: { id: string } }> =
        await authedAs(
          tokenA,
          `mutation { createDeck(input: { title: "Flashcard Test Deck", categoryId: "${categoryId}", difficulty: BEGINNER }) { id } }`,
        );
      deckId = res.body.data!.createDeck.id;
    });

    it('creates a flashcard, auto-assigning orderIndex', async () => {
      const res: GraphQLResponse<{
        createFlashcard: {
          id: string;
          front: string;
          back: string;
          orderIndex: number;
        };
      }> = await authedAs(
        tokenA,
        `mutation { createFlashcard(input: { deckId: "${deckId}", front: "Q1", back: "A1" }) { id front back orderIndex } }`,
      );
      expect(res.body.data!.createFlashcard.orderIndex).toBe(0);
      flashcardId = res.body.data!.createFlashcard.id;

      const secondRes: GraphQLResponse<{
        createFlashcard: { orderIndex: number };
      }> = await authedAs(
        tokenA,
        `mutation { createFlashcard(input: { deckId: "${deckId}", front: "Q2", back: "A2" }) { orderIndex } }`,
      );
      expect(secondRes.body.data!.createFlashcard.orderIndex).toBe(1);
    });

    it("rejects creating a flashcard on another user's deck", async () => {
      const res: GraphQLResponse<null> = await authedAs(
        tokenB,
        `mutation { createFlashcard(input: { deckId: "${deckId}", front: "Q", back: "A" }) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });

    it('lists flashcards via deckFlashcards for the owner', async () => {
      const res: GraphQLResponse<{ deckFlashcards: { front: string }[] }> =
        await authedAs(
          tokenA,
          `{ deckFlashcards(deckId: "${deckId}") { front } }`,
        );
      expect(res.body.data!.deckFlashcards).toHaveLength(2);
    });

    it('rejects deckFlashcards for a non-owner', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        tokenB,
        `{ deckFlashcards(deckId: "${deckId}") { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });

    it("rejects updating another user's flashcard", async () => {
      const res: GraphQLResponse<null> = await authedAs(
        tokenB,
        `mutation { updateFlashcard(id: "${flashcardId}", input: { front: "Hijacked" }) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });

    it('updates own flashcard', async () => {
      const res: GraphQLResponse<{ updateFlashcard: { front: string } }> =
        await authedAs(
          tokenA,
          `mutation { updateFlashcard(id: "${flashcardId}", input: { front: "Updated Q1" }) { front } }`,
        );
      expect(res.body.data!.updateFlashcard.front).toBe('Updated Q1');
    });

    it('deletes own flashcard', async () => {
      const res: GraphQLResponse<{ deleteFlashcard: boolean }> = await authedAs(
        tokenA,
        `mutation { deleteFlashcard(id: "${flashcardId}") }`,
      );
      expect(res.body.data!.deleteFlashcard).toBe(true);

      const listRes: GraphQLResponse<{ deckFlashcards: { id: string }[] }> =
        await authedAs(
          tokenA,
          `{ deckFlashcards(deckId: "${deckId}") { id } }`,
        );
      expect(
        listRes.body.data!.deckFlashcards.some((f) => f.id === flashcardId),
      ).toBe(false);
    });
  });

  describe('POST /api/attachments', () => {
    it('rejects an unauthenticated upload', async () => {
      await request(app.getHttpServer())
        .post('/api/attachments')
        .attach('file', TINY_PNG, 'image.png')
        .expect(401);
    });

    it('rejects a non-image file', async () => {
      await authedAsRest(app, tokenA, '/api/attachments')
        .attach('file', Buffer.from('not an image'), 'notes.txt')
        .expect(400);
    });

    it('uploads an image and returns a usable url', async () => {
      const res: { body: { id: string; url: string } } = await authedAsRest(
        app,
        tokenA,
        '/api/attachments',
      )
        .attach('file', TINY_PNG, 'image.png')
        .expect(201);

      expect(res.body.url).toMatch(/^\/uploads\/attachments\/.+\.png$/);
      uploadedAttachmentPaths.push(
        join(
          ATTACHMENTS_DIR,
          res.body.url.replace('/uploads/attachments/', ''),
        ),
      );

      const attachment = await attachmentRepository.findOneBy({
        id: res.body.id,
      });
      expect(attachment?.url).toBe(res.body.url);
      expect(attachment?.flashcardId).toBeNull();
    });
  });
});

function authedAsRest(app: INestApplication<App>, token: string, path: string) {
  return request(app.getHttpServer())
    .post(path)
    .set('Authorization', `Bearer ${token}`);
}
