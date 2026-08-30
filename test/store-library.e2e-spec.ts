import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { User } from '../src/app-modules/users/entities/user.entity';
import { Deck } from '../src/app-modules/store/entities/deck.entity';

interface GraphQLResponse<T> {
  body: {
    data: T | null;
    errors?: { message: string; extensions?: { code?: string } }[];
  };
}

const TEST_EMAIL = 'e2e-store-library-test@example.com';
const TEST_PASSWORD = 'password123';

function gql(query: string) {
  return { query };
}

describe('Store & Library (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let deckRepository: Repository<Deck>;
  let token: string;
  let seededDeckId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    deckRepository = moduleFixture.get(getRepositoryToken(Deck));
    await userRepository.delete({ email: TEST_EMAIL });

    const registerRes: GraphQLResponse<{
      register: { accessToken: string };
    }> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}", displayName: "Test User" }) { accessToken } }`,
        ),
      );
    token = registerRes.body.data!.register.accessToken;

    const seededDeck = await deckRepository.findOneOrFail({
      where: { isPublic: true },
    });
    seededDeckId = seededDeck.id;
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

  it('rejects browsing the store without authentication', async () => {
    const res: GraphQLResponse<null> = await request(app.getHttpServer())
      .post('/graphql')
      .send(gql(`{ categories { id } }`));

    expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('lists the seeded categories', async () => {
    const res: GraphQLResponse<{
      categories: { name: string; slug: string }[];
    }> = await authed(`{ categories { id name slug } }`);

    const slugs = res.body.data!.categories.map((c) => c.slug).sort();
    expect(slugs).toEqual(['computer-science', 'languages', 'medicine']);
  });

  it('lists public decks with a populated category and cardCount', async () => {
    const res: GraphQLResponse<{
      decks: {
        id: string;
        title: string;
        cardCount: number;
        category: { slug: string };
      }[];
    }> = await authed(`{ decks { id title cardCount category { slug } } }`);

    expect(res.body.data!.decks.length).toBeGreaterThanOrEqual(3);
    const deck = res.body.data!.decks.find((d) => d.id === seededDeckId)!;
    expect(deck.cardCount).toBeGreaterThan(0);
    expect(deck.category.slug).toEqual(expect.any(String));
  });

  it('filters decks by categoryId', async () => {
    const categoriesRes: GraphQLResponse<{
      categories: { id: string; slug: string }[];
    }> = await authed(`{ categories { id slug } }`);
    const cs = categoriesRes.body.data!.categories.find(
      (c) => c.slug === 'computer-science',
    )!;

    const res: GraphQLResponse<{
      decks: { category: { slug: string } }[];
    }> = await authed(
      `{ decks(categoryId: "${cs.id}") { category { slug } } }`,
    );

    expect(res.body.data!.decks.length).toBeGreaterThan(0);
    for (const deck of res.body.data!.decks) {
      expect(deck.category.slug).toBe('computer-science');
    }
  });

  it('fetches a single deck by id', async () => {
    const res: GraphQLResponse<{ deck: { id: string; title: string } }> =
      await authed(`{ deck(id: "${seededDeckId}") { id title } }`);

    expect(res.body.data!.deck.id).toBe(seededDeckId);
  });

  it('returns NOT_FOUND for a nonexistent deck id', async () => {
    const res: GraphQLResponse<null> = await authed(
      `{ deck(id: "00000000-0000-0000-0000-000000000000") { id } }`,
    );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('starts with an empty library for a new user', async () => {
    const res: GraphQLResponse<{ myLibrary: unknown[] }> =
      await authed(`{ myLibrary { id } }`);

    expect(res.body.data!.myLibrary).toEqual([]);
  });

  it('adds a deck to the library', async () => {
    const res: GraphQLResponse<{
      addDeckToLibrary: { id: string; deck: { id: string } };
    }> = await authed(
      `mutation { addDeckToLibrary(deckId: "${seededDeckId}") { id deck { id title } } }`,
    );

    expect(res.body.data!.addDeckToLibrary.deck.id).toBe(seededDeckId);
  });

  it('rejects adding the same deck twice', async () => {
    const res: GraphQLResponse<null> = await authed(
      `mutation { addDeckToLibrary(deckId: "${seededDeckId}") { id } }`,
    );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('CONFLICT');
  });

  it('lists the deck in myLibrary', async () => {
    const res: GraphQLResponse<{
      myLibrary: { deck: { id: string } }[];
    }> = await authed(`{ myLibrary { id deck { id } } }`);

    expect(res.body.data!.myLibrary).toHaveLength(1);
    expect(res.body.data!.myLibrary[0].deck.id).toBe(seededDeckId);
  });

  it('removes the deck from the library', async () => {
    const res: GraphQLResponse<{ removeDeckFromLibrary: boolean }> =
      await authed(
        `mutation { removeDeckFromLibrary(deckId: "${seededDeckId}") }`,
      );

    expect(res.body.data!.removeDeckFromLibrary).toBe(true);
  });

  it('returns NOT_FOUND when removing a deck no longer in the library', async () => {
    const res: GraphQLResponse<null> = await authed(
      `mutation { removeDeckFromLibrary(deckId: "${seededDeckId}") }`,
    );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });
});
