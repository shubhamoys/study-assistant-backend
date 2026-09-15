import { createHmac, randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { User } from '../src/app-modules/users/entities/user.entity';
import { Category } from '../src/app-modules/store/entities/category.entity';
import { Deck } from '../src/app-modules/store/entities/deck.entity';
import { Coupon } from '../src/app-modules/orders/entities/coupon.entity';
import { Order } from '../src/app-modules/orders/entities/order.entity';
import { Library } from '../src/app-modules/library/entities/library.entity';
import { RazorpayClient } from '../src/app-modules/orders/razorpay-client.service';
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

/**
 * Replaces the real Razorpay network calls with deterministic fakes — but
 * deliberately does NOT override `verifySignature`, which is inherited
 * unchanged from the real `RazorpayClient`. That means every e2e test below
 * exercises the actual HMAC verification code path (via the real vendor
 * `validatePaymentVerification` util and the real configured key secret),
 * not a test-only reimplementation of it — the one piece of this flow that
 * genuinely needs to be proven correct, not just plausible.
 */
class TestRazorpayClient extends RazorpayClient {
  lastOrder: { id: string; amount: number; currency: string } | null = null;
  /** Lets a single test simulate a captured payment that doesn't actually match the order (wrong amount/currency/order/status). */
  paymentOverride: Record<string, unknown> | null = null;

  override createOrder(params: {
    amount: number;
    currency: string;
    receipt: string;
  }): ReturnType<RazorpayClient['createOrder']> {
    this.lastOrder = {
      id: `order_fake_${randomUUID()}`,
      amount: params.amount,
      currency: params.currency,
    };
    return Promise.resolve({
      id: this.lastOrder.id,
      amount: params.amount,
      currency: params.currency,
      status: 'created',
    }) as unknown as ReturnType<RazorpayClient['createOrder']>;
  }

  override fetchPayment(
    paymentId: string,
  ): ReturnType<RazorpayClient['fetchPayment']> {
    const base = {
      id: paymentId,
      order_id: this.lastOrder!.id,
      status: 'captured',
      amount: this.lastOrder!.amount,
      currency: this.lastOrder!.currency,
    };
    return Promise.resolve({
      ...base,
      ...(this.paymentOverride ?? {}),
    }) as unknown as ReturnType<RazorpayClient['fetchPayment']>;
  }
}

describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let categoryRepository: Repository<Category>;
  let deckRepository: Repository<Deck>;
  let orderRepository: Repository<Order>;
  let couponRepository: Repository<Coupon>;
  let libraryRepository: Repository<Library>;
  let razorpayClient: TestRazorpayClient;
  let razorpaySecret: string;
  let adminToken: string;
  let userToken: string;
  let userId: string;
  let categoryId: string;
  let orderId: string;

  // Orders must go before decks: OrderItem.deckId is RESTRICT (a purchase
  // history row must survive its deck being deleted, see the entity's doc
  // comment), so deleting a deck that's still referenced by an order — even
  // indirectly, via User's CASCADE onto Deck.authorId — fails. Deleting the
  // order first cascades away its items/payments, clearing the block.
  // Coupons are cleaned up by code prefix, independent of either user (an
  // Order.couponId is SET NULL on delete, so order matters here.
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
    await couponRepository.delete({ code: Like('E2E%') });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RazorpayClient)
      .useClass(TestRazorpayClient)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    categoryRepository = moduleFixture.get(getRepositoryToken(Category));
    deckRepository = moduleFixture.get(getRepositoryToken(Deck));
    orderRepository = moduleFixture.get(getRepositoryToken(Order));
    couponRepository = moduleFixture.get(getRepositoryToken(Coupon));
    libraryRepository = moduleFixture.get(getRepositoryToken(Library));
    razorpayClient = moduleFixture.get(RazorpayClient);
    razorpaySecret = moduleFixture
      .get(ConfigService)
      .get<string>('razorpay.keySecret')!;
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
    userId = (await userRepository.findOneByOrFail({ email: TEST_EMAIL_USER }))
      .id;

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

  async function createCoupon(
    code: string,
    fields: string,
  ): Promise<{ id: string; code: string }> {
    const res: GraphQLResponse<{ createCoupon: { id: string; code: string } }> =
      await authedAs(
        adminToken,
        `mutation { createCoupon(input: { code: "${code}", ${fields} }) { id code } }`,
      );
    return res.body.data!.createCoupon;
  }

  interface CheckoutSession {
    orderId: string;
    requiresPayment: boolean;
    razorpayOrderId: string | null;
    razorpayKeyId: string | null;
    amount: number;
    currency: string;
  }

  async function startCheckout(
    token: string,
    couponCode?: string,
  ): Promise<GraphQLResponse<{ checkout: CheckoutSession }>> {
    const couponArg = couponCode ? `(couponCode: "${couponCode}")` : '';
    return authedAs(
      token,
      `mutation { checkout${couponArg} { orderId requiresPayment razorpayOrderId razorpayKeyId amount currency } }`,
    );
  }

  function computeSignature(
    razorpayOrderId: string,
    paymentId: string,
  ): string {
    return createHmac('sha256', razorpaySecret)
      .update(`${razorpayOrderId}|${paymentId}`)
      .digest('hex');
  }

  /** Simulates the frontend completing a Razorpay payment and submitting it back for verification. */
  async function payAndVerify(
    token: string,
    session: CheckoutSession,
    fields: string,
    overrides?: {
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    },
  ): Promise<GraphQLResponse<{ verifyPayment: Record<string, unknown> }>> {
    const paymentId =
      overrides?.razorpayPaymentId ?? `pay_fake_${randomUUID()}`;
    const razorpayOrderId =
      overrides?.razorpayOrderId ?? session.razorpayOrderId!;
    const signature =
      overrides?.razorpaySignature ??
      computeSignature(razorpayOrderId, paymentId);
    return authedAs(
      token,
      `mutation { verifyPayment(input: { orderId: "${session.orderId}", razorpayOrderId: "${razorpayOrderId}", razorpayPaymentId: "${paymentId}", razorpaySignature: "${signature}" }) { ${fields} } }`,
    );
  }

  it('rejects an unauthenticated checkout', async () => {
    const res: GraphQLResponse<null> = await request(app.getHttpServer())
      .post('/graphql')
      .send(gql(`mutation { checkout { orderId } }`));
    expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('rejects checkout with an empty cart', async () => {
    const res: GraphQLResponse<null> = await authedAs(
      userToken,
      `mutation { checkout { orderId } }`,
    );
    expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
  });

  it('checks out two decks: opens a Razorpay order for the full amount, then completes on a verified payment', async () => {
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

    const sessionRes = await startCheckout(userToken);
    const session = sessionRes.body.data!.checkout;
    expect(session.requiresPayment).toBe(true);
    expect(session.razorpayOrderId).toEqual(expect.any(String));
    expect(session.razorpayKeyId).toEqual(expect.any(String));
    expect(session.amount).toBe(19900 + 30100);
    expect(session.currency).toBe('INR');

    // The order exists but isn't paid yet — no library access, no cart change.
    const midwayCart: GraphQLResponse<{ myCart: { id: string }[] }> =
      await authedAs(userToken, `{ myCart { id } }`);
    expect(midwayCart.body.data!.myCart).toHaveLength(2);

    const res = await payAndVerify(
      userToken,
      session,
      'id status totalAmount currency items { deck { id } price } payments { paymentGateway status amount transactionId }',
    );
    const order = res.body.data!.verifyPayment as {
      id: string;
      status: string;
      totalAmount: number;
      currency: string;
      items: { deck: { id: string }; price: number }[];
      payments: {
        paymentGateway: string;
        status: string;
        amount: number;
        transactionId: string;
      }[];
    };
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
    expect(order.payments[0].paymentGateway).toBe('RAZORPAY');
    expect(order.payments[0].status).toBe('SUCCESS');
    expect(order.payments[0].amount).toBe(order.totalAmount);
    expect(order.payments[0].transactionId).toEqual(expect.any(String));

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

    // A purchase is permanent — can't be removed from the library, even by
    // its own owner, to prevent an accidental-removal data loss.
    const removeRes: GraphQLResponse<null> = await authedAs(
      userToken,
      `mutation { removeDeckFromLibrary(deckId: "${deckAId}") }`,
    );
    expect(removeRes.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('calling verifyPayment again on an already-completed order is idempotent, not an error or a double-grant', async () => {
    const res: GraphQLResponse<{
      verifyPayment: { id: string; status: string };
    }> = await authedAs(
      userToken,
      `mutation { verifyPayment(input: { orderId: "${orderId}", razorpayOrderId: "irrelevant", razorpayPaymentId: "irrelevant", razorpaySignature: "irrelevant" }) { id status } }`,
    );
    expect(res.body.data!.verifyPayment.id).toBe(orderId);
    expect(res.body.data!.verifyPayment.status).toBe('COMPLETED');
  });

  it('rejects a bogus signature', async () => {
    const deckId = await createPaidDeck('E2E Order Bad Sig Deck', 50);
    await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${deckId}") { id } }`,
    );
    const session = (await startCheckout(userToken)).body.data!.checkout;

    const res = await payAndVerify(userToken, session, 'id', {
      razorpaySignature: 'not-a-real-signature',
    });
    expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
  });

  it('rejects a signature valid for a *different* order — closes the cross-order replay bypass', async () => {
    const cheapDeckId = await createPaidDeck('E2E Replay Cheap Deck', 10);
    await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${cheapDeckId}") { id } }`,
    );
    const cheapSession = (await startCheckout(userToken)).body.data!.checkout;
    // A real, validly-signed payment — but for the cheap order.
    const paymentId = `pay_fake_${randomUUID()}`;
    const validSignatureForCheapOrder = computeSignature(
      cheapSession.razorpayOrderId!,
      paymentId,
    );

    const expensiveDeckId = await createPaidDeck(
      'E2E Replay Expensive Deck',
      500,
    );
    await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${expensiveDeckId}") { id } }`,
    );
    const expensiveSession = (await startCheckout(userToken)).body.data!
      .checkout;

    // Replaying the cheap order's valid (razorpayOrderId, paymentId,
    // signature) tuple against the expensive order must be rejected —
    // razorpayOrderId doesn't match what THIS order was actually opened
    // with, regardless of the signature being genuinely valid elsewhere.
    const res = await payAndVerify(userToken, expensiveSession, 'id status', {
      razorpayOrderId: cheapSession.razorpayOrderId!,
      razorpayPaymentId: paymentId,
      razorpaySignature: validSignatureForCheapOrder,
    });
    expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');

    // Neither order was completed by the attempt.
    const cheapOrderRes: GraphQLResponse<{ order: { status: string } }> =
      await authedAs(
        userToken,
        `{ order(id: "${cheapSession.orderId}") { status } }`,
      );
    expect(cheapOrderRes.body.data!.order.status).toBe('CANCELLED');
    const expensiveOrderRes: GraphQLResponse<{ order: { status: string } }> =
      await authedAs(
        userToken,
        `{ order(id: "${expensiveSession.orderId}") { status } }`,
      );
    expect(expensiveOrderRes.body.data!.order.status).toBe('PENDING');
  });

  it("rejects a technically-valid signature if Razorpay's own payment record doesn't actually match (amount tampering defense-in-depth)", async () => {
    const deckId = await createPaidDeck('E2E Amount Mismatch Deck', 75);
    await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${deckId}") { id } }`,
    );
    const session = (await startCheckout(userToken)).body.data!.checkout;

    // Simulate Razorpay reporting a captured payment for the wrong amount —
    // this should never happen for real (Razorpay enforces the order's own
    // amount), but proves the server doesn't rely on the signature alone.
    razorpayClient.paymentOverride = { amount: 1 };
    const res = await payAndVerify(userToken, session, 'id');
    razorpayClient.paymentOverride = null;

    expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
    const orderRes: GraphQLResponse<{ order: { status: string } }> =
      await authedAs(
        userToken,
        `{ order(id: "${session.orderId}") { status } }`,
      );
    expect(orderRes.body.data!.order.status).toBe('PENDING');
  });

  it('a new checkout cancels the previous still-pending one for the same user', async () => {
    const deckId = await createPaidDeck('E2E Superseded Deck', 30);
    await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${deckId}") { id } }`,
    );
    const firstSession = (await startCheckout(userToken)).body.data!.checkout;

    // Retrying (cart untouched) opens a second checkout for the same item.
    const secondSession = (await startCheckout(userToken)).body.data!.checkout;
    expect(secondSession.orderId).not.toBe(firstSession.orderId);

    const firstOrderRes: GraphQLResponse<{ order: { status: string } }> =
      await authedAs(
        userToken,
        `{ order(id: "${firstSession.orderId}") { status } }`,
      );
    expect(firstOrderRes.body.data!.order.status).toBe('CANCELLED');

    // Clean up — pay for the second attempt so the deck doesn't linger mid-flow.
    await payAndVerify(userToken, secondSession, 'id');
  });

  it("verifyPayment 404s for another user's order, or a missing one", async () => {
    const missingRes: GraphQLResponse<null> = await authedAs(
      userToken,
      `mutation { verifyPayment(input: { orderId: "00000000-0000-0000-0000-000000000000", razorpayOrderId: "x", razorpayPaymentId: "x", razorpaySignature: "x" }) { id } }`,
    );
    expect(missingRes.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');

    const othersRes: GraphQLResponse<null> = await authedAs(
      adminToken,
      `mutation { verifyPayment(input: { orderId: "${orderId}", razorpayOrderId: "x", razorpayPaymentId: "x", razorpaySignature: "x" }) { id } }`,
    );
    expect(othersRes.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('drops a cart item whose deck went free before checkout, rather than failing the whole order, and removes it from the cart immediately', async () => {
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

    const session = (await startCheckout(userToken)).body.data!.checkout;
    expect(session.amount).toBe(10000);

    // The dropped item is removed from the cart immediately at checkout
    // time — it doesn't belong there anymore either (now free) — while the
    // one actually being purchased stays until payment is confirmed.
    const cartRes: GraphQLResponse<{ myCart: { deck: { id: string } }[] }> =
      await authedAs(userToken, `{ myCart { deck { id } } }`);
    expect(cartRes.body.data!.myCart).toHaveLength(1);
    expect(cartRes.body.data!.myCart[0].deck.id).toBe(staysPaidId);

    const res = await payAndVerify(
      userToken,
      session,
      'items { deck { id } } totalAmount',
    );
    const order = res.body.data!.verifyPayment as {
      items: { deck: { id: string } }[];
      totalAmount: number;
    };
    expect(order.items).toHaveLength(1);
    expect(order.items[0].deck.id).toBe(staysPaidId);
    expect(order.totalAmount).toBe(10000);

    const finalCartRes: GraphQLResponse<{ myCart: { id: string }[] }> =
      await authedAs(userToken, `{ myCart { id } }`);
    expect(finalCartRes.body.data!.myCart).toEqual([]);
  });

  it('drops a cart item the user already owns, rather than charging for it again', async () => {
    const staysPaidId = await createPaidDeck('E2E Order Stays Paid 2', 120);
    const alreadyOwnedId = await createPaidDeck('E2E Order Already Owned', 175);

    await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${staysPaidId}") { id } }`,
    );
    // addDeckToCart itself would now reject this (see cart.e2e-spec.ts), so
    // insert the cart row directly to simulate one that predates that guard,
    // or a deck acquired some other way after it was already in the cart —
    // checkout's own drop-stale-items filter is what this test targets.
    await authedAs(
      userToken,
      `mutation { addDeckToCart(deckId: "${alreadyOwnedId}") { id } }`,
    );
    await libraryRepository.save(
      libraryRepository.create({ userId, deckId: alreadyOwnedId }),
    );

    const session = (await startCheckout(userToken)).body.data!.checkout;
    expect(session.amount).toBe(12000);

    const cartRes: GraphQLResponse<{ myCart: { deck: { id: string } }[] }> =
      await authedAs(userToken, `{ myCart { deck { id } } }`);
    expect(cartRes.body.data!.myCart).toHaveLength(1);
    expect(cartRes.body.data!.myCart[0].deck.id).toBe(staysPaidId);

    const res = await payAndVerify(
      userToken,
      session,
      'items { deck { id } } totalAmount',
    );
    const order = res.body.data!.verifyPayment as {
      items: { deck: { id: string } }[];
      totalAmount: number;
    };
    expect(order.items).toHaveLength(1);
    expect(order.items[0].deck.id).toBe(staysPaidId);
    expect(order.totalAmount).toBe(12000);
  });

  it('lists the completed order in myOrders, but not a cancelled/abandoned one', async () => {
    const res: GraphQLResponse<{ myOrders: { id: string; status: string }[] }> =
      await authedAs(userToken, `{ myOrders { id status } }`);
    expect(
      res.body.data!.myOrders.some(
        (order) => order.id === orderId && order.status === 'COMPLETED',
      ),
    ).toBe(true);
    expect(
      res.body.data!.myOrders.every((order) => order.status !== 'CANCELLED'),
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

  describe('Coupons', () => {
    it('rejects a non-admin creating or listing coupons', async () => {
      const createRes: GraphQLResponse<null> = await authedAs(
        userToken,
        `mutation { createCoupon(input: { code: "E2E-NOPE", discountType: PERCENTAGE, discountValue: 10 }) { id } }`,
      );
      expect(createRes.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');

      const listRes: GraphQLResponse<null> = await authedAs(
        userToken,
        `{ adminCoupons { id } }`,
      );
      expect(listRes.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('creates a coupon, lists it in adminCoupons, and rejects a duplicate code', async () => {
      const coupon = await createCoupon(
        'E2E-LIST',
        'discountType: PERCENTAGE, discountValue: 15',
      );

      const listRes: GraphQLResponse<{
        adminCoupons: { id: string; code: string; isActive: boolean }[];
      }> = await authedAs(adminToken, `{ adminCoupons { id code isActive } }`);
      expect(
        listRes.body.data!.adminCoupons.some(
          (c) => c.id === coupon.id && c.code === 'E2E-LIST' && c.isActive,
        ),
      ).toBe(true);

      const dupRes: GraphQLResponse<null> = await authedAs(
        adminToken,
        `mutation { createCoupon(input: { code: "e2e-list", discountType: FIXED_AMOUNT, discountValue: 100 }) { id } }`,
      );
      expect(dupRes.body.errors?.[0]?.extensions?.code).toBe('CONFLICT');
    });

    it('rejects a PERCENTAGE coupon over 100', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        adminToken,
        `mutation { createCoupon(input: { code: "E2E-OVER100", discountType: PERCENTAGE, discountValue: 150 }) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
    });

    it('previewCoupon computes the discount without redeeming it, and rejects an unknown code', async () => {
      const deckId = await createPaidDeck('E2E Coupon Preview Deck', 200);
      await createCoupon(
        'E2E-PREVIEW20',
        'discountType: PERCENTAGE, discountValue: 20',
      );
      await authedAs(
        userToken,
        `mutation { addDeckToCart(deckId: "${deckId}") { id } }`,
      );

      const res: GraphQLResponse<{
        previewCoupon: {
          code: string;
          subtotalAmount: number;
          discountAmount: number;
          totalAmount: number;
        };
      }> = await authedAs(
        userToken,
        `{ previewCoupon(code: "e2e-preview20") { code subtotalAmount discountAmount totalAmount } }`,
      );
      expect(res.body.data!.previewCoupon).toEqual({
        code: 'E2E-PREVIEW20',
        subtotalAmount: 20000,
        discountAmount: 4000,
        totalAmount: 16000,
      });

      // Redemption count is untouched by a preview — only a completed order redeems.
      const couponsRes: GraphQLResponse<{
        adminCoupons: { code: string; redemptionsCount: number }[];
      }> = await authedAs(
        adminToken,
        `{ adminCoupons { code redemptionsCount } }`,
      );
      expect(
        couponsRes.body.data!.adminCoupons.find(
          (c) => c.code === 'E2E-PREVIEW20',
        )?.redemptionsCount,
      ).toBe(0);

      const unknownRes: GraphQLResponse<null> = await authedAs(
        userToken,
        `{ previewCoupon(code: "E2E-NONEXISTENT") { code } }`,
      );
      expect(unknownRes.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');

      // Clear the cart so it doesn't bleed into the next test.
      await authedAs(
        userToken,
        `mutation { removeDeckFromCart(deckId: "${deckId}") }`,
      );
    });

    it('applies a PERCENTAGE coupon at checkout and increments its redemption count once the payment is verified', async () => {
      const deckId = await createPaidDeck('E2E Coupon Percent Deck', 200);
      await createCoupon(
        'E2E-PERCENT20',
        'discountType: PERCENTAGE, discountValue: 20',
      );
      await authedAs(
        userToken,
        `mutation { addDeckToCart(deckId: "${deckId}") { id } }`,
      );

      const sessionRes = await startCheckout(userToken, 'e2e-percent20');
      const session = sessionRes.body.data!.checkout;
      expect(session.amount).toBe(16000);

      // Not redeemed yet — only a completed order counts.
      const beforeRes: GraphQLResponse<{
        adminCoupons: { code: string; redemptionsCount: number }[];
      }> = await authedAs(
        adminToken,
        `{ adminCoupons { code redemptionsCount } }`,
      );
      expect(
        beforeRes.body.data!.adminCoupons.find(
          (c) => c.code === 'E2E-PERCENT20',
        )?.redemptionsCount,
      ).toBe(0);

      const res = await payAndVerify(
        userToken,
        session,
        'subtotalAmount discountAmount totalAmount couponCode',
      );
      expect(res.body.data!.verifyPayment).toEqual({
        subtotalAmount: 20000,
        discountAmount: 4000,
        totalAmount: 16000,
        couponCode: 'E2E-PERCENT20',
      });

      const afterRes: GraphQLResponse<{
        adminCoupons: { code: string; redemptionsCount: number }[];
      }> = await authedAs(
        adminToken,
        `{ adminCoupons { code redemptionsCount } }`,
      );
      expect(
        afterRes.body.data!.adminCoupons.find((c) => c.code === 'E2E-PERCENT20')
          ?.redemptionsCount,
      ).toBe(1);
    });

    it('caps a FIXED_AMOUNT coupon at the subtotal so the total never goes negative, and skips Razorpay entirely when it covers the order in full', async () => {
      const deckId = await createPaidDeck('E2E Coupon Fixed Deck', 50);
      await createCoupon(
        'E2E-FIXED100',
        'discountType: FIXED_AMOUNT, discountValue: 10000',
      );
      await authedAs(
        userToken,
        `mutation { addDeckToCart(deckId: "${deckId}") { id } }`,
      );

      const sessionRes = await startCheckout(userToken, 'E2E-FIXED100');
      const session = sessionRes.body.data!.checkout;
      // Fully covered — no Razorpay order was ever opened, and it's
      // already COMPLETED by the time `checkout` returns.
      expect(session.requiresPayment).toBe(false);
      expect(session.razorpayOrderId).toBeNull();
      expect(session.amount).toBe(0);

      const orderRes: GraphQLResponse<{
        order: {
          status: string;
          subtotalAmount: number;
          discountAmount: number;
          totalAmount: number;
          payments: { paymentGateway: string; status: string }[];
        };
      }> = await authedAs(
        userToken,
        `{ order(id: "${session.orderId}") { status subtotalAmount discountAmount totalAmount payments { paymentGateway status } } }`,
      );
      expect(orderRes.body.data!.order).toEqual({
        status: 'COMPLETED',
        subtotalAmount: 5000,
        discountAmount: 5000,
        totalAmount: 0,
        payments: [{ paymentGateway: 'MANUAL', status: 'SUCCESS' }],
      });
    });

    it('rejects a coupon below its minOrderAmount, past its expiry, or over its redemption limit', async () => {
      const cheapDeckId = await createPaidDeck('E2E Coupon Min Deck', 10);
      await createCoupon(
        'E2E-MINORDER',
        'discountType: FIXED_AMOUNT, discountValue: 100, minOrderAmount: 100000',
      );
      await authedAs(
        userToken,
        `mutation { addDeckToCart(deckId: "${cheapDeckId}") { id } }`,
      );
      const minRes = await startCheckout(userToken, 'E2E-MINORDER');
      expect(minRes.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
      await authedAs(
        userToken,
        `mutation { removeDeckFromCart(deckId: "${cheapDeckId}") }`,
      );

      const expiredDeckId = await createPaidDeck('E2E Coupon Expired Deck', 20);
      await createCoupon(
        'E2E-EXPIRED',
        `discountType: PERCENTAGE, discountValue: 10, expiresAt: "2020-01-01T00:00:00.000Z"`,
      );
      await authedAs(
        userToken,
        `mutation { addDeckToCart(deckId: "${expiredDeckId}") { id } }`,
      );
      const expiredRes = await startCheckout(userToken, 'E2E-EXPIRED');
      expect(expiredRes.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
      await authedAs(
        userToken,
        `mutation { removeDeckFromCart(deckId: "${expiredDeckId}") }`,
      );

      const limitedDeckId = await createPaidDeck('E2E Coupon Limited Deck', 20);
      await createCoupon(
        'E2E-LIMITED',
        'discountType: PERCENTAGE, discountValue: 10, maxRedemptions: 1',
      );
      await authedAs(
        userToken,
        `mutation { addDeckToCart(deckId: "${limitedDeckId}") { id } }`,
      );
      const firstSession = (await startCheckout(userToken, 'E2E-LIMITED')).body
        .data!.checkout;
      const firstUseRes = await payAndVerify(userToken, firstSession, 'id');
      expect(firstUseRes.body.data!.verifyPayment.id).toEqual(
        expect.any(String),
      );

      const secondDeckId = await createPaidDeck(
        'E2E Coupon Limited Deck 2',
        20,
      );
      await authedAs(
        userToken,
        `mutation { addDeckToCart(deckId: "${secondDeckId}") { id } }`,
      );
      const secondUseRes = await startCheckout(userToken, 'E2E-LIMITED');
      expect(secondUseRes.body.errors?.[0]?.extensions?.code).toBe(
        'BAD_REQUEST',
      );
      await authedAs(
        userToken,
        `mutation { removeDeckFromCart(deckId: "${secondDeckId}") }`,
      );
    });

    it('deactivating a coupon makes it unusable at checkout, and rejects an unknown code the same way', async () => {
      const deckId = await createPaidDeck('E2E Coupon Deactivated Deck', 20);
      const coupon = await createCoupon(
        'E2E-DEACTIVATE',
        'discountType: PERCENTAGE, discountValue: 10',
      );
      await authedAs(
        adminToken,
        `mutation { updateCoupon(id: "${coupon.id}", input: { isActive: false }) { id isActive } }`,
      );
      await authedAs(
        userToken,
        `mutation { addDeckToCart(deckId: "${deckId}") { id } }`,
      );

      const deactivatedRes = await startCheckout(userToken, 'E2E-DEACTIVATE');
      expect(deactivatedRes.body.errors?.[0]?.extensions?.code).toBe(
        'NOT_FOUND',
      );

      const unknownRes = await startCheckout(userToken, 'E2E-TOTALLY-UNKNOWN');
      expect(unknownRes.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');

      // Checkout without a coupon still works normally for the same cart.
      const session = (await startCheckout(userToken)).body.data!.checkout;
      const res = await payAndVerify(userToken, session, 'discountAmount');
      expect(res.body.data!.verifyPayment.discountAmount).toBe(0);
    });
  });
});
