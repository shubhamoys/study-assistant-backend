import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { User } from '../src/app-modules/users/entities/user.entity';
import { Category } from '../src/app-modules/store/entities/category.entity';
import { Deck } from '../src/app-modules/store/entities/deck.entity';
import { Library } from '../src/app-modules/library/entities/library.entity';
import { UserRole } from '../src/database/enums';

interface GraphQLResponse<T> {
  body: {
    data: T | null;
    errors?: { message: string; extensions?: { code?: string } }[];
  };
}

const TEST_EMAIL_ADMIN = 'e2e-cart-test-admin@example.com';
const TEST_EMAIL_USER = 'e2e-cart-test-user@example.com';
const TEST_EMAIL_OTHER_USER = 'e2e-cart-test-other-user@example.com';
const TEST_PASSWORD = 'password123';

function gql(query: string) {
  return { query };
}

describe('Cart (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let categoryRepository: Repository<Category>;
  let deckRepository: Repository<Deck>;
  let libraryRepository: Repository<Library>;
  let adminToken: string;
  let userToken: string;
  let otherUserToken: string;
  let adminId: string;
  let userId: string;
  let paidDeckId: string;
  let freeDeckId: string;
  let ownedPaidDeckId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    categoryRepository = moduleFixture.get(getRepositoryToken(Category));
    deckRepository = moduleFixture.get(getRepositoryToken(Deck));
    libraryRepository = moduleFixture.get(getRepositoryToken(Library));
    await userRepository.delete({ email: TEST_EMAIL_ADMIN });
    await userRepository.delete({ email: TEST_EMAIL_USER });
    await userRepository.delete({ email: TEST_EMAIL_OTHER_USER });

    const registerAdmin: GraphQLResponse<{
      register: { accessToken: string };
    }> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "${TEST_EMAIL_ADMIN}", password: "${TEST_PASSWORD}", displayName: "Cart Admin E2E" }) { accessToken } }`,
        ),
      );
    adminToken = registerAdmin.body.data!.register.accessToken;
    await userRepository.update(
      { email: TEST_EMAIL_ADMIN },
      { role: UserRole.ADMIN },
    );
    adminId = (
      await userRepository.findOneByOrFail({ email: TEST_EMAIL_ADMIN })
    ).id;

    const registerUser: GraphQLResponse<{
      register: { accessToken: string };
    }> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "${TEST_EMAIL_USER}", password: "${TEST_PASSWORD}", displayName: "Cart User E2E" }) { accessToken } }`,
        ),
      );
    userToken = registerUser.body.data!.register.accessToken;

    const registerOtherUser: GraphQLResponse<{
      register: { accessToken: string };
    }> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "${TEST_EMAIL_OTHER_USER}", password: "${TEST_PASSWORD}", displayName: "Cart Other User E2E" }) { accessToken } }`,
        ),
      );
    otherUserToken = registerOtherUser.body.data!.register.accessToken;
    userId = (await userRepository.findOneByOrFail({ email: TEST_EMAIL_USER }))
      .id;

    const [category] = await categoryRepository.find({ take: 1 });

    const createPaidDeck: GraphQLResponse<{ adminCreateDeck: { id: string } }> =
      await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          gql(
            `mutation { adminCreateDeck(input: { title: "E2E Cart Paid Deck", categoryId: "${category.id}", difficulty: BEGINNER, isFree: false, priceRupees: 299 }) { id } }`,
          ),
        );
    paidDeckId = createPaidDeck.body.data!.adminCreateDeck.id;

    const createFreeDeck: GraphQLResponse<{ adminCreateDeck: { id: string } }> =
      await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          gql(
            `mutation { adminCreateDeck(input: { title: "E2E Cart Free Deck", categoryId: "${category.id}", difficulty: BEGINNER }) { id } }`,
          ),
        );
    freeDeckId = createFreeDeck.body.data!.adminCreateDeck.id;

    const createOwnedPaidDeck: GraphQLResponse<{
      adminCreateDeck: { id: string };
    }> = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(
        gql(
          `mutation { adminCreateDeck(input: { title: "E2E Cart Already-Owned Deck", categoryId: "${category.id}", difficulty: BEGINNER, isFree: false, priceRupees: 199 }) { id } }`,
        ),
      );
    ownedPaidDeckId = createOwnedPaidDeck.body.data!.adminCreateDeck.id;
    // Simulates having already bought this deck (normally granted by
    // checkout) — the point of this fixture is to test addDeckToCart's own
    // ownership check independent of the checkout flow itself.
    await libraryRepository.save(
      libraryRepository.create({ userId, deckId: ownedPaidDeckId }),
    );
  });

  afterAll(async () => {
    await deckRepository.delete({ authorId: adminId });
    await userRepository.delete({ email: TEST_EMAIL_ADMIN });
    await userRepository.delete({ email: TEST_EMAIL_USER });
    await userRepository.delete({ email: TEST_EMAIL_OTHER_USER });
    await app.close();
  });

  function authedAs(token: string, query: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql(query));
  }

  it('rejects an unauthenticated request', async () => {
    const res: GraphQLResponse<null> = await request(app.getHttpServer())
      .post('/graphql')
      .send(gql(`{ myCart { id } }`));
    expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('starts empty', async () => {
    const res: GraphQLResponse<{ myCart: { id: string }[] }> = await authedAs(
      userToken,
      `{ myCart { id } }`,
    );
    expect(res.body.data!.myCart).toEqual([]);
  });

  it('refuses to add a free deck — that goes through addDeckToLibrary instead', async () => {
    const res: GraphQLResponse<null> = await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${freeDeckId}") { id } }`,
    );
    expect(res.body.errors?.[0]?.extensions?.code).toBe('CONFLICT');
  });

  it('rejects adding a deck the user already owns', async () => {
    const res: GraphQLResponse<null> = await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${ownedPaidDeckId}") { id } }`,
    );
    expect(res.body.errors?.[0]?.extensions?.code).toBe('CONFLICT');

    const cartRes: GraphQLResponse<{ myCart: { deck: { id: string } }[] }> =
      await authedAs(userToken, `{ myCart { deck { id } } }`);
    expect(
      cartRes.body.data!.myCart.some(
        (item) => item.deck.id === ownedPaidDeckId,
      ),
    ).toBe(false);
  });

  it('404s adding a deck that does not exist', async () => {
    const res: GraphQLResponse<null> = await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "00000000-0000-0000-0000-000000000000") { id } }`,
    );
    expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('adds a paid deck to the cart, with the deck details attached', async () => {
    const res: GraphQLResponse<{
      addDeckToCart: { id: string; deck: { id: string; isFree: boolean } };
    }> = await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${paidDeckId}") { id deck { id isFree } } }`,
    );
    expect(res.body.data!.addDeckToCart.deck.id).toBe(paidDeckId);
    expect(res.body.data!.addDeckToCart.deck.isFree).toBe(false);

    const cartRes: GraphQLResponse<{ myCart: { deck: { id: string } }[] }> =
      await authedAs(userToken, `{ myCart { deck { id } } }`);
    expect(
      cartRes.body.data!.myCart.some((item) => item.deck.id === paidDeckId),
    ).toBe(true);
  });

  it('rejects adding the same deck twice', async () => {
    const res: GraphQLResponse<null> = await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${paidDeckId}") { id } }`,
    );
    expect(res.body.errors?.[0]?.extensions?.code).toBe('CONFLICT');
  });

  it("cart is per-user — another user's cart is unaffected", async () => {
    const res: GraphQLResponse<{ myCart: { id: string }[] }> = await authedAs(
      otherUserToken,
      `{ myCart { id } }`,
    );
    expect(res.body.data!.myCart).toEqual([]);
  });

  it('removes the deck from the cart', async () => {
    const res: GraphQLResponse<{ removeDeckFromCart: boolean }> =
      await authedAs(
        userToken,
        `mutation { removeDeckFromCart(deckId: "${paidDeckId}") }`,
      );
    expect(res.body.data!.removeDeckFromCart).toBe(true);

    const cartRes: GraphQLResponse<{ myCart: { deck: { id: string } }[] }> =
      await authedAs(userToken, `{ myCart { deck { id } } }`);
    expect(
      cartRes.body.data!.myCart.some((item) => item.deck.id === paidDeckId),
    ).toBe(false);
  });

  it('404s removing a deck not in the cart', async () => {
    const res: GraphQLResponse<null> = await authedAs(
      userToken,
      `mutation { removeDeckFromCart(deckId: "${paidDeckId}") }`,
    );
    expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });
});
