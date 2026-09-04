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
import { Order } from '../src/app-modules/orders/entities/order.entity';
import { UserRole } from '../src/database/enums';

interface GraphQLResponse<T> {
  body: {
    data: T | null;
    errors?: { message: string; extensions?: { code?: string } }[];
  };
}

const TEST_EMAIL_ADMIN = 'e2e-orders-test-admin@example.com';
const TEST_EMAIL_USER = 'e2e-orders-test-user@example.com';
const TEST_PASSWORD = 'password123';

function gql(query: string) {
  return { query };
}

describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let categoryRepository: Repository<Category>;
  let deckRepository: Repository<Deck>;
  let orderRepository: Repository<Order>;
  let adminToken: string;
  let userToken: string;
  let categoryId: string;
  let orderId: string;

  // Orders must go before decks: OrderItem.deckId is RESTRICT (a purchase
  // history row must survive its deck being deleted, see the entity's doc
  // comment), so deleting a deck that's still referenced by an order — even
  // indirectly, via User's CASCADE onto Deck.authorId — fails. Deleting the
  // order first cascades away its items/payments, clearing the block.
  async function cleanupTestData() {
    const buyer = await userRepository.findOneBy({ email: TEST_EMAIL_USER });
    if (buyer) {
      await orderRepository.delete({ userId: buyer.id });
    }
    const admin = await userRepository.findOneBy({ email: TEST_EMAIL_ADMIN });
    if (admin) {
      await deckRepository.delete({ authorId: admin.id });
    }
    await userRepository.delete({ email: TEST_EMAIL_ADMIN });
    await userRepository.delete({ email: TEST_EMAIL_USER });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    categoryRepository = moduleFixture.get(getRepositoryToken(Category));
    deckRepository = moduleFixture.get(getRepositoryToken(Deck));
    orderRepository = moduleFixture.get(getRepositoryToken(Order));
    await cleanupTestData();

    const registerAdmin: GraphQLResponse<{
      register: { accessToken: string };
    }> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "${TEST_EMAIL_ADMIN}", password: "${TEST_PASSWORD}", displayName: "Orders Admin E2E" }) { accessToken } }`,
        ),
      );
    adminToken = registerAdmin.body.data!.register.accessToken;
    await userRepository.update(
      { email: TEST_EMAIL_ADMIN },
      { role: UserRole.ADMIN },
    );

    const registerUser: GraphQLResponse<{
      register: { accessToken: string };
    }> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "${TEST_EMAIL_USER}", password: "${TEST_PASSWORD}", displayName: "Orders User E2E" }) { accessToken } }`,
        ),
      );
    userToken = registerUser.body.data!.register.accessToken;

    const [category] = await categoryRepository.find({ take: 1 });
    categoryId = category.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  function authedAs(token: string, query: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql(query));
  }

  async function createPaidDeck(title: string, priceRupees: number) {
    const res: GraphQLResponse<{ adminCreateDeck: { id: string } }> =
      await authedAs(
        adminToken,
        `mutation { adminCreateDeck(input: { title: "${title}", categoryId: "${categoryId}", difficulty: BEGINNER, isFree: false, priceRupees: ${priceRupees} }) { id } }`,
      );
    return res.body.data!.adminCreateDeck.id;
  }

  it('rejects an unauthenticated checkout', async () => {
    const res: GraphQLResponse<null> = await request(app.getHttpServer())
      .post('/graphql')
      .send(gql(`mutation { checkout { id } }`));
    expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('rejects checkout with an empty cart', async () => {
    const res: GraphQLResponse<null> = await authedAs(
      userToken,
      `mutation { checkout { id } }`,
    );
    expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
  });

  it('checks out two decks in one order: creates the order, items, a MANUAL payment, grants library access, and clears the cart', async () => {
    const deckAId = await createPaidDeck('E2E Order Deck A', 199);
    const deckBId = await createPaidDeck('E2E Order Deck B', 301);

    await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${deckAId}") { id } }`,
    );
    await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${deckBId}") { id } }`,
    );

    const res: GraphQLResponse<{
      checkout: {
        id: string;
        status: string;
        totalAmount: number;
        currency: string;
        items: { deck: { id: string }; price: number }[];
        payments: { paymentGateway: string; status: string; amount: number }[];
      };
    }> = await authedAs(
      userToken,
      `mutation { checkout { id status totalAmount currency items { deck { id } price } payments { paymentGateway status amount } } }`,
    );
    const order = res.body.data!.checkout;
    orderId = order.id;

    expect(order.status).toBe('COMPLETED');
    expect(order.currency).toBe('INR');
    expect(order.totalAmount).toBe(19900 + 30100);
    expect(order.items).toHaveLength(2);
    expect(order.items.map((i) => i.deck.id).sort()).toEqual(
      [deckAId, deckBId].sort(),
    );
    expect(order.items.find((i) => i.deck.id === deckAId)?.price).toBe(19900);
    expect(order.payments).toHaveLength(1);
    expect(order.payments[0].paymentGateway).toBe('MANUAL');
    expect(order.payments[0].status).toBe('SUCCESS');
    expect(order.payments[0].amount).toBe(order.totalAmount);

    // Cart is cleared.
    const cartRes: GraphQLResponse<{ myCart: { id: string }[] }> =
      await authedAs(userToken, `{ myCart { id } }`);
    expect(cartRes.body.data!.myCart).toEqual([]);

    // Library access was granted for both purchased decks.
    const libraryRes: GraphQLResponse<{
      myLibrary: { deck: { id: string } }[];
    }> = await authedAs(userToken, `{ myLibrary { deck { id } } }`);
    const libraryDeckIds = libraryRes.body.data!.myLibrary.map(
      (entry) => entry.deck.id,
    );
    expect(libraryDeckIds).toEqual(expect.arrayContaining([deckAId, deckBId]));

    // downloadsCount incremented for a purchased deck.
    const deckRes: GraphQLResponse<{ deck: { downloadsCount: number } }> =
      await authedAs(
        userToken,
        `{ deck(id: "${deckAId}") { downloadsCount } }`,
      );
    expect(deckRes.body.data!.deck.downloadsCount).toBe(1);
  });

  it('drops a cart item whose deck went free before checkout, rather than failing the whole order', async () => {
    const staysPaidId = await createPaidDeck('E2E Order Stays Paid', 100);
    const goesFreeId = await createPaidDeck('E2E Order Goes Free', 150);

    await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${staysPaidId}") { id } }`,
    );
    await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${goesFreeId}") { id } }`,
    );

    // Admin flips one of the two to free after it's already in the cart.
    await authedAs(
      adminToken,
      `mutation { adminUpdateDeck(id: "${goesFreeId}", input: { isFree: true }) { id } }`,
    );

    const res: GraphQLResponse<{
      checkout: { items: { deck: { id: string } }[]; totalAmount: number };
    }> = await authedAs(
      userToken,
      `mutation { checkout { items { deck { id } } totalAmount } }`,
    );
    expect(res.body.data!.checkout.items).toHaveLength(1);
    expect(res.body.data!.checkout.items[0].deck.id).toBe(staysPaidId);
    expect(res.body.data!.checkout.totalAmount).toBe(10000);

    // The dropped item doesn't get left stranded in the cart — it doesn't
    // belong there anymore either, now that the deck is free.
    const cartRes: GraphQLResponse<{ myCart: { id: string }[] }> =
      await authedAs(userToken, `{ myCart { id } }`);
    expect(cartRes.body.data!.myCart).toEqual([]);
  });

  it('lists the completed order in myOrders', async () => {
    const res: GraphQLResponse<{ myOrders: { id: string; status: string }[] }> =
      await authedAs(userToken, `{ myOrders { id status } }`);
    expect(
      res.body.data!.myOrders.some(
        (order) => order.id === orderId && order.status === 'COMPLETED',
      ),
    ).toBe(true);
  });

  it('fetches a single order by id, owner-only', async () => {
    const res: GraphQLResponse<{ order: { id: string } }> = await authedAs(
      userToken,
      `{ order(id: "${orderId}") { id } }`,
    );
    expect(res.body.data!.order.id).toBe(orderId);
  });

  it("404s fetching another user's order (or a missing one)", async () => {
    const res: GraphQLResponse<null> = await authedAs(
      adminToken,
      `{ order(id: "${orderId}") { id } }`,
    );
    expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });
});
