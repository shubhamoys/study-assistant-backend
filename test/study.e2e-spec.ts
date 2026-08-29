import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { User } from '../src/app-modules/users/entities/user.entity';
import { Deck } from '../src/app-modules/store/entities/deck.entity';
import { StudySession } from '../src/app-modules/study/entities/study-session.entity';

interface GraphQLResponse<T> {
  body: {
    data: T | null;
    errors?: { message: string; extensions?: { code?: string } }[];
  };
}

const TEST_EMAIL = 'e2e-study-test@example.com';
const TEST_PASSWORD = 'password123';

function gql(query: string) {
  return { query };
}

describe('Study (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let deckRepository: Repository<Deck>;
  let studySessionRepository: Repository<StudySession>;
  let token: string;
  let libraryDeckId: string;
  let otherDeckId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    deckRepository = moduleFixture.get(getRepositoryToken(Deck));
    studySessionRepository = moduleFixture.get(
      getRepositoryToken(StudySession),
    );
    await userRepository.delete({ email: TEST_EMAIL });

    const registerRes: GraphQLResponse<{ register: { accessToken: string } }> =
      await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { register(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}" }) { accessToken } }`,
          ),
        );
    token = registerRes.body.data!.register.accessToken;

    const decks = await deckRepository.find({
      where: { isPublic: true },
      take: 2,
    });
    libraryDeckId = decks[0].id;
    otherDeckId = decks[1].id;

    await authed(
      `mutation { addDeckToLibrary(deckId: "${libraryDeckId}") { id } }`,
    );
  });

  afterAll(async () => {
    await userRepository.delete({ email: TEST_EMAIL });
    await app.close();
  });

  function authed(query: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql(query));
  }

  it('rejects studyQueue without authentication', async () => {
    const res: GraphQLResponse<null> = await request(app.getHttpServer())
      .post('/graphql')
      .send(gql(`{ studyQueue(deckId: "${libraryDeckId}") { dueCount } }`));

    expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('rejects studying a deck that is not in the library', async () => {
    const res: GraphQLResponse<null> = await authed(
      `{ studyQueue(deckId: "${otherDeckId}") { dueCount } }`,
    );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('starts with every card new and none due', async () => {
    const res: GraphQLResponse<{
      studyQueue: {
        deckId: string;
        dueCount: number;
        newCount: number;
        totalCount: number;
      };
    }> = await authed(
      `{ studyQueue(deckId: "${libraryDeckId}") { deckId dueCount newCount totalCount } }`,
    );

    const queue = res.body.data!.studyQueue;
    expect(queue.dueCount).toBe(0);
    expect(queue.newCount).toBeGreaterThan(0);
    expect(queue.totalCount).toBe(queue.newCount);
  });

  it('returns the next card with a preview interval for every rating', async () => {
    const res: GraphQLResponse<{
      nextCard: {
        cardId: string;
        front: string;
        back: string;
        again: { intervalLabel: string; dueAt: string };
        hard: { intervalLabel: string; dueAt: string };
        good: { intervalLabel: string; dueAt: string };
        easy: { intervalLabel: string; dueAt: string };
      };
    }> = await authed(
      `{ nextCard(deckId: "${libraryDeckId}") {
        cardId front back
        again { intervalLabel dueAt }
        hard { intervalLabel dueAt }
        good { intervalLabel dueAt }
        easy { intervalLabel dueAt }
      } }`,
    );

    const card = res.body.data!.nextCard;
    expect(card.cardId).toEqual(expect.any(String));
    expect(card.front.length).toBeGreaterThan(0);
    expect(card.back.length).toBeGreaterThan(0);
    for (const preview of [card.again, card.hard, card.good, card.easy]) {
      expect(preview.intervalLabel).toMatch(/^\d+[mhd]$/);
      expect(new Date(preview.dueAt).getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('submits a card review, schedules it into the future, and starts a session', async () => {
    const baselineRes: GraphQLResponse<{ studyQueue: { newCount: number } }> =
      await authed(`{ studyQueue(deckId: "${libraryDeckId}") { newCount } }`);
    const baselineNewCount = baselineRes.body.data!.studyQueue.newCount;

    const nextCardRes: GraphQLResponse<{ nextCard: { cardId: string } }> =
      await authed(`{ nextCard(deckId: "${libraryDeckId}") { cardId } }`);
    const cardId = nextCardRes.body.data!.nextCard.cardId;

    const res: GraphQLResponse<{
      submitCardReview: {
        sessionId: string;
        cardId: string;
        state: string;
        dueAt: string;
        stability: number;
        difficulty: number;
      };
    }> = await authed(
      `mutation { submitCardReview(input: { deckId: "${libraryDeckId}", cardId: "${cardId}", rating: GOOD }) {
        sessionId cardId state dueAt stability difficulty
      } }`,
    );

    const result = res.body.data!.submitCardReview;
    expect(result.cardId).toBe(cardId);
    expect(result.sessionId).toEqual(expect.any(String));
    expect(['NEW', 'LEARNING', 'REVIEW', 'RELEARNING']).toContain(result.state);
    expect(result.state).not.toBe('NEW');
    expect(new Date(result.dueAt).getTime()).toBeGreaterThan(Date.now());
    expect(result.stability).toBeGreaterThanOrEqual(0);
    expect(result.difficulty).toBeGreaterThanOrEqual(0);

    const session = await studySessionRepository.findOneByOrFail({
      id: result.sessionId,
    });
    expect(session.cardsReviewed).toBe(1);
    expect(session.endedAt).toBeNull();

    // reduces newCount by one now that this card has progress
    const queueRes: GraphQLResponse<{
      studyQueue: { newCount: number };
    }> = await authed(
      `{ studyQueue(deckId: "${libraryDeckId}") { newCount } }`,
    );
    expect(queueRes.body.data!.studyQueue.newCount).toBe(baselineNewCount - 1);

    // a second review reusing the same sessionId accumulates on one session
    const nextCard2Res: GraphQLResponse<{ nextCard: { cardId: string } }> =
      await authed(`{ nextCard(deckId: "${libraryDeckId}") { cardId } }`);
    const cardId2 = nextCard2Res.body.data!.nextCard.cardId;
    expect(cardId2).not.toBe(cardId);

    const res2: GraphQLResponse<{ submitCardReview: { sessionId: string } }> =
      await authed(
        `mutation { submitCardReview(input: { deckId: "${libraryDeckId}", cardId: "${cardId2}", rating: EASY, sessionId: "${result.sessionId}" }) { sessionId } }`,
      );
    expect(res2.body.data!.submitCardReview.sessionId).toBe(result.sessionId);

    const updatedSession = await studySessionRepository.findOneByOrFail({
      id: result.sessionId,
    });
    expect(updatedSession.cardsReviewed).toBe(2);

    const completeRes: GraphQLResponse<{ completeStudySession: boolean }> =
      await authed(
        `mutation { completeStudySession(sessionId: "${result.sessionId}") }`,
      );
    expect(completeRes.body.data!.completeStudySession).toBe(true);

    const completedSession = await studySessionRepository.findOneByOrFail({
      id: result.sessionId,
    });
    expect(completedSession.endedAt).not.toBeNull();
  });

  it('returns NOT_FOUND completing a session that does not belong to the user', async () => {
    const res: GraphQLResponse<null> = await authed(
      `mutation { completeStudySession(sessionId: "00000000-0000-0000-0000-000000000000") }`,
    );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('returns NOT_FOUND submitting a review for a deck not in the library', async () => {
    const res: GraphQLResponse<null> = await authed(
      `mutation { submitCardReview(input: { deckId: "${otherDeckId}", cardId: "00000000-0000-0000-0000-000000000000", rating: GOOD }) { sessionId } }`,
    );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });
});
