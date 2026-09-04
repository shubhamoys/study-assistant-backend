import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { User } from '../src/app-modules/users/entities/user.entity';
import { Deck } from '../src/app-modules/store/entities/deck.entity';
import { Review } from '../src/app-modules/reviews/entities/review.entity';

interface GraphQLResponse<T> {
  body: {
    data: T | null;
    errors?: { message: string; extensions?: { code?: string } }[];
  };
}

const TEST_EMAIL_A = 'e2e-reviews-test-a@example.com';
const TEST_EMAIL_B = 'e2e-reviews-test-b@example.com';
const TEST_PASSWORD = 'password123';

function gql(query: string) {
  return { query };
}

describe('Reviews (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let deckRepository: Repository<Deck>;
  let reviewRepository: Repository<Review>;
  let tokenA: string;
  let tokenB: string;
  let deckId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    deckRepository = moduleFixture.get(getRepositoryToken(Deck));
    reviewRepository = moduleFixture.get(getRepositoryToken(Review));
    await userRepository.delete({ email: TEST_EMAIL_A });
    await userRepository.delete({ email: TEST_EMAIL_B });

    const registerA: GraphQLResponse<{ register: { accessToken: string } }> =
      await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { register(input: { email: "${TEST_EMAIL_A}", password: "${TEST_PASSWORD}", displayName: "Reviewer A" }) { accessToken } }`,
          ),
        );
    tokenA = registerA.body.data!.register.accessToken;

    const registerB: GraphQLResponse<{ register: { accessToken: string } }> =
      await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { register(input: { email: "${TEST_EMAIL_B}", password: "${TEST_PASSWORD}", displayName: "Reviewer B" }) { accessToken } }`,
          ),
        );
    tokenB = registerB.body.data!.register.accessToken;

    // Pinned to a specific seeded deck by title, not "any public deck" —
    // seeded decks are the only ones guaranteed to exist for the whole
    // suite's lifetime and never be concurrently mutated/deleted by another
    // spec file's own test-created (and test-deleted) decks running in a
    // parallel Jest worker against the same shared dev database.
    const deck = await deckRepository.findOneOrFail({
      where: { title: 'JavaScript Fundamentals' },
    });
    deckId = deck.id;

    const [userA, userB] = await Promise.all([
      userRepository.findOneByOrFail({ email: TEST_EMAIL_A }),
      userRepository.findOneByOrFail({ email: TEST_EMAIL_B }),
    ]);

    // A clean slate for this deck's rating math, regardless of what a
    // previous run of this same spec left behind (afterAll already deletes
    // the users, which cascades their reviews — this only matters if a
    // prior run crashed before reaching afterAll).
    await reviewRepository.delete({ deckId, userId: userA.id });
    await reviewRepository.delete({ deckId, userId: userB.id });
    await recomputeDeckRating();
  });

  async function recomputeDeckRating(): Promise<void> {
    const raw = await reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .addSelect('COUNT(*)', 'count')
      .where('review.deckId = :deckId', { deckId })
      .getRawOne<{ average: string | null; count: string }>();
    await deckRepository.update(deckId, {
      ratingAverage: raw?.average ? Number(raw.average) : 0,
      ratingCount: Number(raw?.count ?? 0),
    });
  }

  afterAll(async () => {
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

  async function deckRating(): Promise<{ average: number; count: number }> {
    const deck = await deckRepository.findOneByOrFail({ id: deckId });
    return { average: deck.ratingAverage, count: deck.ratingCount };
  }

  /**
   * Independently recomputes what the deck's rating *should* be straight
   * from the `reviews` table, so assertions don't need to know about (or be
   * broken by) whatever seed-data reviews already exist on this deck.
   */
  async function expectedRating(): Promise<{ average: number; count: number }> {
    const reviews = await reviewRepository.findBy({ deckId });
    const count = reviews.length;
    const average = count
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / count
      : 0;
    return { average, count };
  }

  it('requires auth to list reviews', async () => {
    const res: GraphQLResponse<null> = await request(app.getHttpServer())
      .post('/graphql')
      .send(gql(`{ deckReviews(deckId: "${deckId}") { id } }`));

    expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a rating outside 1-5', async () => {
    const res: GraphQLResponse<null> = await authedAs(
      tokenA,
      `mutation { createReview(input: { deckId: "${deckId}", rating: 6 }) { id } }`,
    );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
  });

  it('creates a review and recomputes the deck rating', async () => {
    const res: GraphQLResponse<{
      createReview: { id: string; rating: number; authorDisplayName: string };
    }> = await authedAs(
      tokenA,
      `mutation { createReview(input: { deckId: "${deckId}", rating: 5, comment: "Great deck" }) { id rating comment authorDisplayName } }`,
    );

    expect(res.body.data!.createReview.rating).toBe(5);
    expect(res.body.data!.createReview.authorDisplayName).toBe('Reviewer A');

    // Verified against an independent recomputation from the reviews table
    // (see `expectedRating`), not a hardcoded value — this deck may already
    // carry seed-data reviews, so the absolute average isn't known upfront.
    const after = await deckRating();
    const expected = await expectedRating();
    expect(after.count).toBe(expected.count);
    expect(after.average).toBeCloseTo(expected.average, 5);
  });

  it('rejects a second review from the same user for the same deck', async () => {
    const res: GraphQLResponse<null> = await authedAs(
      tokenA,
      `mutation { createReview(input: { deckId: "${deckId}", rating: 3 }) { id } }`,
    );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('CONFLICT');
  });

  it('lists the review via deckReviews', async () => {
    const res: GraphQLResponse<{
      deckReviews: { rating: number; authorDisplayName: string }[];
    }> = await authedAs(
      tokenB,
      `{ deckReviews(deckId: "${deckId}") { rating authorDisplayName } }`,
    );

    expect(
      res.body.data!.deckReviews.some(
        (r) => r.authorDisplayName === 'Reviewer A' && r.rating === 5,
      ),
    ).toBe(true);
  });

  it("rejects updating another user's review", async () => {
    const listRes: GraphQLResponse<{
      deckReviews: { id: string; authorDisplayName: string }[];
    }> = await authedAs(
      tokenB,
      `{ deckReviews(deckId: "${deckId}") { id authorDisplayName } }`,
    );
    const reviewAId = listRes.body.data!.deckReviews.find(
      (r) => r.authorDisplayName === 'Reviewer A',
    )!.id;

    const res: GraphQLResponse<null> = await authedAs(
      tokenB,
      `mutation { updateReview(id: "${reviewAId}", input: { rating: 1 }) { id } }`,
    );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('updates own review and recomputes the deck rating', async () => {
    const listRes: GraphQLResponse<{
      deckReviews: { id: string; authorDisplayName: string }[];
    }> = await authedAs(
      tokenA,
      `{ deckReviews(deckId: "${deckId}") { id authorDisplayName } }`,
    );
    const reviewAId = listRes.body.data!.deckReviews.find(
      (r) => r.authorDisplayName === 'Reviewer A',
    )!.id;

    const res: GraphQLResponse<{
      updateReview: { rating: number; comment: string | null };
    }> = await authedAs(
      tokenA,
      `mutation { updateReview(id: "${reviewAId}", input: { rating: 2, comment: "Changed my mind" }) { rating comment } }`,
    );

    expect(res.body.data!.updateReview.rating).toBe(2);
    expect(res.body.data!.updateReview.comment).toBe('Changed my mind');

    const after = await deckRating();
    const expected = await expectedRating();
    expect(after.average).toBeCloseTo(expected.average, 5);
    expect(after.count).toBe(expected.count);
  });

  it("rejects deleting another user's review", async () => {
    const listRes: GraphQLResponse<{
      deckReviews: { id: string; authorDisplayName: string }[];
    }> = await authedAs(
      tokenB,
      `{ deckReviews(deckId: "${deckId}") { id authorDisplayName } }`,
    );
    const reviewAId = listRes.body.data!.deckReviews.find(
      (r) => r.authorDisplayName === 'Reviewer A',
    )!.id;

    const res: GraphQLResponse<null> = await authedAs(
      tokenB,
      `mutation { deleteReview(id: "${reviewAId}") }`,
    );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('deletes own review and recomputes the deck rating', async () => {
    const listRes: GraphQLResponse<{
      deckReviews: { id: string; authorDisplayName: string }[];
    }> = await authedAs(
      tokenA,
      `{ deckReviews(deckId: "${deckId}") { id authorDisplayName } }`,
    );
    const reviewAId = listRes.body.data!.deckReviews.find(
      (r) => r.authorDisplayName === 'Reviewer A',
    )!.id;

    const res: GraphQLResponse<{ deleteReview: boolean }> = await authedAs(
      tokenA,
      `mutation { deleteReview(id: "${reviewAId}") }`,
    );
    expect(res.body.data!.deleteReview).toBe(true);

    const after = await deckRating();
    const expected = await expectedRating();
    expect(after.count).toBe(expected.count);
    expect(after.average).toBeCloseTo(expected.average, 5);

    // Reviewer A's review is really gone, not just excluded from the average.
    const remaining = await reviewRepository.findBy({ deckId });
    expect(remaining.find((r) => r.id === reviewAId)).toBeUndefined();
  });
});
