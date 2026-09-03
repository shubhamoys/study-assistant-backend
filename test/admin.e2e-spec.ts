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
import { UserRole } from '../src/database/enums';

interface GraphQLResponse<T> {
  body: {
    data: T | null;
    errors?: { message: string; extensions?: { code?: string } }[];
  };
}

const TEST_EMAIL_ADMIN = 'e2e-admin-test-admin@example.com';
const TEST_EMAIL_USER = 'e2e-admin-test-user@example.com';
const TEST_PASSWORD = 'password123';

function gql(query: string) {
  return { query };
}

const TEST_EMAIL_NEW_ADMIN = 'e2e-admin-test-new-admin@example.com';
const TEST_CATEGORY_NAME = 'E2E Test Category';

describe('Admin (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let categoryRepository: Repository<Category>;
  let deckRepository: Repository<Deck>;
  let adminToken: string;
  let userToken: string;
  let adminId: string;
  let userId: string;
  let existingCategoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    categoryRepository = moduleFixture.get(getRepositoryToken(Category));
    deckRepository = moduleFixture.get(getRepositoryToken(Deck));
    await userRepository.delete({ email: TEST_EMAIL_ADMIN });
    await userRepository.delete({ email: TEST_EMAIL_USER });
    await userRepository.delete({ email: TEST_EMAIL_NEW_ADMIN });
    await categoryRepository.delete({ name: TEST_CATEGORY_NAME });

    const registerAdmin: GraphQLResponse<{
      register: { accessToken: string };
    }> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "${TEST_EMAIL_ADMIN}", password: "${TEST_PASSWORD}", displayName: "Admin E2E" }) { accessToken } }`,
        ),
      );
    adminToken = registerAdmin.body.data!.register.accessToken;
    // JwtStrategy.validate reloads the user from the DB on every request
    // (see that file) rather than trusting the JWT payload's role, so
    // promoting here takes effect on adminToken's very next request — no
    // need to issue a fresh token.
    await userRepository.update(
      { email: TEST_EMAIL_ADMIN },
      { role: UserRole.ADMIN },
    );
    adminId = (
      await userRepository.findOneByOrFail({
        email: TEST_EMAIL_ADMIN,
      })
    ).id;

    const registerUser: GraphQLResponse<{
      register: { accessToken: string };
    }> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "${TEST_EMAIL_USER}", password: "${TEST_PASSWORD}", displayName: "User E2E" }) { accessToken } }`,
        ),
      );
    userToken = registerUser.body.data!.register.accessToken;
    userId = (await userRepository.findOneByOrFail({ email: TEST_EMAIL_USER }))
      .id;

    const [category] = await categoryRepository.find({ take: 1 });
    existingCategoryId = category.id;
  });

  afterAll(async () => {
    await deckRepository.delete({ authorId: adminId });
    await categoryRepository.delete({ name: TEST_CATEGORY_NAME });
    await userRepository.delete({ email: TEST_EMAIL_ADMIN });
    await userRepository.delete({ email: TEST_EMAIL_NEW_ADMIN });
    await userRepository.delete({ email: TEST_EMAIL_USER });
    await app.close();
  });

  function authedAs(token: string, query: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql(query));
  }

  describe('adminDashboardStats', () => {
    it('rejects a non-admin with FORBIDDEN', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        userToken,
        `{ adminDashboardStats { totalUsers } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('rejects an unauthenticated request with UNAUTHENTICATED', async () => {
      const res: GraphQLResponse<null> = await request(app.getHttpServer())
        .post('/graphql')
        .send(gql(`{ adminDashboardStats { totalUsers } }`));
      expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('returns stats for an admin', async () => {
      const res: GraphQLResponse<{
        adminDashboardStats: {
          totalUsers: number;
          totalDecks: number;
          totalPublicDecks: number;
          totalFlashcards: number;
          totalReviews: number;
          newUsersLast7Days: number;
        };
      }> = await authedAs(
        adminToken,
        `{ adminDashboardStats { totalUsers totalDecks totalPublicDecks totalFlashcards totalReviews newUsersLast7Days } }`,
      );
      const stats = res.body.data!.adminDashboardStats;
      // Real counts, not hardcoded expectations — this instance's exact
      // seed/fixture data isn't this test's concern, only that the query
      // works end-to-end and returns sane (non-negative) numbers, and that
      // the two accounts this test itself just created are reflected.
      expect(stats.totalUsers).toBeGreaterThanOrEqual(2);
      expect(stats.totalDecks).toBeGreaterThanOrEqual(0);
      expect(stats.totalPublicDecks).toBeGreaterThanOrEqual(0);
      expect(stats.totalFlashcards).toBeGreaterThanOrEqual(0);
      expect(stats.totalReviews).toBeGreaterThanOrEqual(0);
      expect(stats.newUsersLast7Days).toBeGreaterThanOrEqual(2);
    });
  });

  describe('adminUsers / adminUser', () => {
    it('rejects a non-admin with FORBIDDEN', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        userToken,
        `{ adminUsers { totalCount } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('lists users, searchable by email', async () => {
      const res: GraphQLResponse<{
        adminUsers: {
          items: { id: string; email: string }[];
          totalCount: number;
        };
      }> = await authedAs(
        adminToken,
        `{ adminUsers(search: "${TEST_EMAIL_USER}") { items { id email } totalCount } }`,
      );
      const result = res.body.data!.adminUsers;
      expect(result.items.some((u) => u.email === TEST_EMAIL_USER)).toBe(true);
      expect(result.totalCount).toBeGreaterThanOrEqual(1);
    });

    it('filters users by role', async () => {
      const res: GraphQLResponse<{
        adminUsers: { items: { role: string }[] };
      }> = await authedAs(
        adminToken,
        `{ adminUsers(role: ADMIN, limit: 100) { items { role } } }`,
      );
      expect(
        res.body.data!.adminUsers.items.every((u) => u.role === 'ADMIN'),
      ).toBe(true);
    });

    it('fetches a single user by id', async () => {
      const res: GraphQLResponse<{ adminUser: { id: string; email: string } }> =
        await authedAs(
          adminToken,
          `{ adminUser(id: "${userId}") { id email } }`,
        );
      expect(res.body.data!.adminUser.email).toBe(TEST_EMAIL_USER);
    });

    it('404s for a missing user id', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        adminToken,
        `{ adminUser(id: "00000000-0000-0000-0000-000000000000") { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });
  });

  describe('adminUpdateUserRole', () => {
    it('rejects a non-admin with FORBIDDEN', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        userToken,
        `mutation { adminUpdateUserRole(id: "${userId}", role: ADMIN) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('promotes a user to ADMIN', async () => {
      const res: GraphQLResponse<{ adminUpdateUserRole: { role: string } }> =
        await authedAs(
          adminToken,
          `mutation { adminUpdateUserRole(id: "${userId}", role: ADMIN) { id role } }`,
        );
      expect(res.body.data!.adminUpdateUserRole.role).toBe('ADMIN');
    });

    it('demotes back to USER', async () => {
      const res: GraphQLResponse<{ adminUpdateUserRole: { role: string } }> =
        await authedAs(
          adminToken,
          `mutation { adminUpdateUserRole(id: "${userId}", role: USER) { id role } }`,
        );
      expect(res.body.data!.adminUpdateUserRole.role).toBe('USER');
    });

    it('blocks an admin from demoting themselves', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        adminToken,
        `mutation { adminUpdateUserRole(id: "${adminId}", role: USER) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('404s for a missing user id', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        adminToken,
        `mutation { adminUpdateUserRole(id: "00000000-0000-0000-0000-000000000000", role: ADMIN) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });
  });

  describe('adminCreateAdminUser', () => {
    it('rejects a non-admin with FORBIDDEN', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        userToken,
        `mutation { adminCreateAdminUser(input: { email: "${TEST_EMAIL_NEW_ADMIN}", password: "${TEST_PASSWORD}", displayName: "New Admin" }) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('creates a new admin account, verified and role ADMIN', async () => {
      const res: GraphQLResponse<{
        adminCreateAdminUser: {
          id: string;
          role: string;
          isEmailVerified: boolean;
        };
      }> = await authedAs(
        adminToken,
        `mutation { adminCreateAdminUser(input: { email: "${TEST_EMAIL_NEW_ADMIN}", password: "${TEST_PASSWORD}", displayName: "New Admin" }) { id role isEmailVerified } }`,
      );
      expect(res.body.data!.adminCreateAdminUser.role).toBe('ADMIN');
      expect(res.body.data!.adminCreateAdminUser.isEmailVerified).toBe(true);
    });

    it('rejects a duplicate email', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        adminToken,
        `mutation { adminCreateAdminUser(input: { email: "${TEST_EMAIL_NEW_ADMIN}", password: "${TEST_PASSWORD}", displayName: "Dup" }) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('CONFLICT');
    });

    it('the new admin can log in and access an admin-only query', async () => {
      const loginRes: GraphQLResponse<{ login: { accessToken: string } }> =
        await request(app.getHttpServer())
          .post('/graphql')
          .send(
            gql(
              `mutation { login(input: { email: "${TEST_EMAIL_NEW_ADMIN}", password: "${TEST_PASSWORD}" }) { accessToken } }`,
            ),
          );
      const newAdminToken = loginRes.body.data!.login.accessToken;
      const res: GraphQLResponse<{
        adminDashboardStats: { totalUsers: number };
      }> = await authedAs(
        newAdminToken,
        `{ adminDashboardStats { totalUsers } }`,
      );
      expect(res.body.data!.adminDashboardStats.totalUsers).toBeGreaterThan(0);
    });
  });

  describe('createCategory / updateCategory / deleteCategory', () => {
    let categoryId: string;

    it('rejects a non-admin with FORBIDDEN', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        userToken,
        `mutation { createCategory(input: { name: "${TEST_CATEGORY_NAME}" }) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('creates a category with a derived slug', async () => {
      const res: GraphQLResponse<{
        createCategory: { id: string; slug: string };
      }> = await authedAs(
        adminToken,
        `mutation { createCategory(input: { name: "${TEST_CATEGORY_NAME}" }) { id slug } }`,
      );
      expect(res.body.data!.createCategory.slug).toBe('e2e-test-category');
      categoryId = res.body.data!.createCategory.id;
    });

    it('rejects a duplicate name', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        adminToken,
        `mutation { createCategory(input: { name: "${TEST_CATEGORY_NAME}" }) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('CONFLICT');
    });

    it('updates the name and re-derives the slug', async () => {
      const res: GraphQLResponse<{
        updateCategory: { name: string; slug: string };
      }> = await authedAs(
        adminToken,
        `mutation { updateCategory(id: "${categoryId}", input: { name: "E2E Renamed Category" }) { name slug } }`,
      );
      expect(res.body.data!.updateCategory.slug).toBe('e2e-renamed-category');
    });

    it('uncategorizes referencing decks instead of blocking the delete', async () => {
      const createDeckRes: GraphQLResponse<{ createDeck: { id: string } }> =
        await authedAs(
          adminToken,
          `mutation { createDeck(input: { title: "E2E Category Delete Test Deck", categoryId: "${categoryId}" }) { id } }`,
        );
      const deckId = createDeckRes.body.data!.createDeck.id;

      const deleteRes: GraphQLResponse<{ deleteCategory: boolean }> =
        await authedAs(
          adminToken,
          `mutation { deleteCategory(id: "${categoryId}") }`,
        );
      expect(deleteRes.body.data!.deleteCategory).toBe(true);

      const deckRes: GraphQLResponse<{
        deck: { category: { id: string } | null };
      }> = await authedAs(
        adminToken,
        `{ deck(id: "${deckId}") { category { id } } }`,
      );
      expect(deckRes.body.data!.deck.category).toBeNull();
    });

    it('404s deleting a missing category', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        adminToken,
        `mutation { deleteCategory(id: "00000000-0000-0000-0000-000000000000") }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });
  });

  describe('adminCreateDeck / adminUpdateDeck / adminDeleteDeck', () => {
    let deckId: string;

    it('rejects a non-admin with FORBIDDEN', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        userToken,
        `mutation { adminCreateDeck(input: { title: "X", categoryId: "${existingCategoryId}", difficulty: BEGINNER }) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('creates a public deck, immediately visible in the public store browse', async () => {
      const res: GraphQLResponse<{
        adminCreateDeck: { id: string; title: string; authorId: string };
      }> = await authedAs(
        adminToken,
        `mutation { adminCreateDeck(input: { title: "E2E Admin Deck", categoryId: "${existingCategoryId}", difficulty: BEGINNER }) { id title authorId } }`,
      );
      deckId = res.body.data!.adminCreateDeck.id;
      expect(res.body.data!.adminCreateDeck.title).toBe('E2E Admin Deck');

      // DeckType never exposes isPublic directly — the real proof is that a
      // completely different, non-admin user sees it in the public browse.
      const browseRes: GraphQLResponse<{ decks: { id: string }[] }> =
        await authedAs(userToken, `{ decks { id } }`);
      expect(browseRes.body.data!.decks.some((d) => d.id === deckId)).toBe(
        true,
      );
    });

    it('updates it', async () => {
      const res: GraphQLResponse<{
        adminUpdateDeck: { title: string; difficulty: string };
      }> = await authedAs(
        adminToken,
        `mutation { adminUpdateDeck(id: "${deckId}", input: { title: "E2E Admin Deck Renamed", difficulty: ADVANCED }) { title difficulty } }`,
      );
      expect(res.body.data!.adminUpdateDeck.title).toBe(
        'E2E Admin Deck Renamed',
      );
      expect(res.body.data!.adminUpdateDeck.difficulty).toBe('ADVANCED');
    });

    it("a different admin (not the deck's creator) can also update it — public decks are platform content, not personal", async () => {
      const loginRes: GraphQLResponse<{ login: { accessToken: string } }> =
        await request(app.getHttpServer())
          .post('/graphql')
          .send(
            gql(
              `mutation { login(input: { email: "${TEST_EMAIL_NEW_ADMIN}", password: "${TEST_PASSWORD}" }) { accessToken } }`,
            ),
          );
      const otherAdminToken = loginRes.body.data!.login.accessToken;
      const res: GraphQLResponse<{ adminUpdateDeck: { title: string } }> =
        await authedAs(
          otherAdminToken,
          `mutation { adminUpdateDeck(id: "${deckId}", input: { title: "Edited By Another Admin" }) { title } }`,
        );
      expect(res.body.data!.adminUpdateDeck.title).toBe(
        'Edited By Another Admin',
      );
    });

    it("refuses to touch a user's private custom deck through this mutation", async () => {
      const createRes: GraphQLResponse<{ createDeck: { id: string } }> =
        await authedAs(
          userToken,
          `mutation { createDeck(input: { title: "E2E Private Deck" }) { id } }`,
        );
      const privateDeckId = createRes.body.data!.createDeck.id;

      const res: GraphQLResponse<null> = await authedAs(
        adminToken,
        `mutation { adminUpdateDeck(id: "${privateDeckId}", input: { title: "Hijacked" }) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });

    it('deleting it also removes it from every library it was added to', async () => {
      await authedAs(
        userToken,
        `mutation { addDeckToLibrary(deckId: "${deckId}") { id } }`,
      );

      const deleteRes: GraphQLResponse<{ adminDeleteDeck: boolean }> =
        await authedAs(
          adminToken,
          `mutation { adminDeleteDeck(id: "${deckId}") }`,
        );
      expect(deleteRes.body.data!.adminDeleteDeck).toBe(true);

      // Would 500 (dangling null-joined deck) if the library entry wasn't
      // cleaned up alongside the delete — same fix as the regular deleteDeck.
      const libraryRes: GraphQLResponse<{
        myLibrary: { deck: { id: string } }[];
      }> = await authedAs(userToken, `{ myLibrary { deck { id } } }`);
      expect(
        libraryRes.body.data!.myLibrary.some(
          (entry) => entry.deck.id === deckId,
        ),
      ).toBe(false);
    });

    it('404s deleting a missing deck', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        adminToken,
        `mutation { adminDeleteDeck(id: "00000000-0000-0000-0000-000000000000") }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });
  });

  describe('admin deck pricing (isFree / price)', () => {
    it('defaults to free when isFree is omitted entirely', async () => {
      const res: GraphQLResponse<{
        adminCreateDeck: { id: string; isFree: boolean; price: number };
      }> = await authedAs(
        adminToken,
        `mutation { adminCreateDeck(input: { title: "E2E Default Free Deck", categoryId: "${existingCategoryId}", difficulty: BEGINNER }) { id isFree price } }`,
      );
      expect(res.body.data!.adminCreateDeck.isFree).toBe(true);
      expect(res.body.data!.adminCreateDeck.price).toBe(0);
    });

    it('rejects creating a paid deck with no price', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        adminToken,
        `mutation { adminCreateDeck(input: { title: "E2E No Price Deck", categoryId: "${existingCategoryId}", difficulty: BEGINNER, isFree: false }) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
    });

    it('creates a paid deck, converting whole-rupee input to paise', async () => {
      const res: GraphQLResponse<{
        adminCreateDeck: { id: string; isFree: boolean; price: number };
      }> = await authedAs(
        adminToken,
        `mutation { adminCreateDeck(input: { title: "E2E Paid Deck", categoryId: "${existingCategoryId}", difficulty: BEGINNER, isFree: false, priceRupees: 499 }) { id isFree price } }`,
      );
      expect(res.body.data!.adminCreateDeck.isFree).toBe(false);
      expect(res.body.data!.adminCreateDeck.price).toBe(49900);
      const paidDeckId = res.body.data!.adminCreateDeck.id;

      // A paid deck can never be acquired through the free one-click path.
      const libraryRes: GraphQLResponse<null> = await authedAs(
        userToken,
        `mutation { addDeckToLibrary(deckId: "${paidDeckId}") { id } }`,
      );
      expect(libraryRes.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('flips a deck from free to paid on update, and back to free', async () => {
      const createRes: GraphQLResponse<{ adminCreateDeck: { id: string } }> =
        await authedAs(
          adminToken,
          `mutation { adminCreateDeck(input: { title: "E2E Flip Deck", categoryId: "${existingCategoryId}", difficulty: BEGINNER }) { id } }`,
        );
      const flipDeckId = createRes.body.data!.adminCreateDeck.id;

      const toPaidRes: GraphQLResponse<{
        adminUpdateDeck: { isFree: boolean; price: number };
      }> = await authedAs(
        adminToken,
        `mutation { adminUpdateDeck(id: "${flipDeckId}", input: { isFree: false, priceRupees: 199 }) { isFree price } }`,
      );
      expect(toPaidRes.body.data!.adminUpdateDeck.isFree).toBe(false);
      expect(toPaidRes.body.data!.adminUpdateDeck.price).toBe(19900);

      const toFreeRes: GraphQLResponse<{
        adminUpdateDeck: { isFree: boolean; price: number };
      }> = await authedAs(
        adminToken,
        `mutation { adminUpdateDeck(id: "${flipDeckId}", input: { isFree: true }) { isFree price } }`,
      );
      expect(toFreeRes.body.data!.adminUpdateDeck.isFree).toBe(true);
      expect(toFreeRes.body.data!.adminUpdateDeck.price).toBe(0);
    });
  });

  describe('adminDeckFlashcards / adminCreateFlashcard / adminUpdateFlashcard / adminDeleteFlashcard', () => {
    let deckId: string;
    let flashcardId: string;

    beforeAll(async () => {
      const res: GraphQLResponse<{ adminCreateDeck: { id: string } }> =
        await authedAs(
          adminToken,
          `mutation { adminCreateDeck(input: { title: "E2E Admin Flashcard Deck", categoryId: "${existingCategoryId}", difficulty: BEGINNER }) { id } }`,
        );
      deckId = res.body.data!.adminCreateDeck.id;
    });

    it('rejects a non-admin with FORBIDDEN', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        userToken,
        `mutation { adminCreateFlashcard(input: { deckId: "${deckId}", front: "Q", back: "A" }) { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('creates a flashcard on the public deck', async () => {
      const res: GraphQLResponse<{
        adminCreateFlashcard: { id: string; front: string };
      }> = await authedAs(
        adminToken,
        `mutation { adminCreateFlashcard(input: { deckId: "${deckId}", front: "What is FSRS?", back: "A spaced-repetition scheduler" }) { id front } }`,
      );
      flashcardId = res.body.data!.adminCreateFlashcard.id;
      expect(res.body.data!.adminCreateFlashcard.front).toBe('What is FSRS?');
    });

    it('lists it via adminDeckFlashcards', async () => {
      const res: GraphQLResponse<{
        adminDeckFlashcards: { id: string }[];
      }> = await authedAs(
        adminToken,
        `{ adminDeckFlashcards(deckId: "${deckId}") { id } }`,
      );
      expect(
        res.body.data!.adminDeckFlashcards.some((c) => c.id === flashcardId),
      ).toBe(true);
    });

    it('refuses to list flashcards for a private custom deck', async () => {
      const createRes: GraphQLResponse<{ createDeck: { id: string } }> =
        await authedAs(
          userToken,
          `mutation { createDeck(input: { title: "E2E Private Deck For Flashcards" }) { id } }`,
        );
      const res: GraphQLResponse<null> = await authedAs(
        adminToken,
        `{ adminDeckFlashcards(deckId: "${createRes.body.data!.createDeck.id}") { id } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });

    it('updates the flashcard', async () => {
      const res: GraphQLResponse<{ adminUpdateFlashcard: { back: string } }> =
        await authedAs(
          adminToken,
          `mutation { adminUpdateFlashcard(id: "${flashcardId}", input: { back: "Free Spaced Repetition Scheduler" }) { back } }`,
        );
      expect(res.body.data!.adminUpdateFlashcard.back).toBe(
        'Free Spaced Repetition Scheduler',
      );
    });

    it('deletes the flashcard', async () => {
      const res: GraphQLResponse<{ adminDeleteFlashcard: boolean }> =
        await authedAs(
          adminToken,
          `mutation { adminDeleteFlashcard(id: "${flashcardId}") }`,
        );
      expect(res.body.data!.adminDeleteFlashcard).toBe(true);

      const listRes: GraphQLResponse<{
        adminDeckFlashcards: { id: string }[];
      }> = await authedAs(
        adminToken,
        `{ adminDeckFlashcards(deckId: "${deckId}") { id } }`,
      );
      expect(
        listRes.body.data!.adminDeckFlashcards.some(
          (c) => c.id === flashcardId,
        ),
      ).toBe(false);
    });
  });

  describe('adminAnalytics', () => {
    it('rejects a non-admin with FORBIDDEN', async () => {
      const res: GraphQLResponse<null> = await authedAs(
        userToken,
        `{ adminAnalytics { signupsByDay { date count } } }`,
      );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('returns real data across every metric', async () => {
      const res: GraphQLResponse<{
        adminAnalytics: {
          decksPerCategory: { categoryName: string; deckCount: number }[];
          topDecksByDownloads: { id: string; downloadsCount: number }[];
          topDecksByRating: { id: string; ratingAverage: number }[];
          signupsByDay: { date: string; count: number }[];
          reviewsByDay: { date: string; count: number }[];
        };
      }> = await authedAs(
        adminToken,
        `{ adminAnalytics {
          decksPerCategory { categoryName deckCount }
          topDecksByDownloads { id title downloadsCount }
          topDecksByRating { id title ratingAverage ratingCount }
          signupsByDay { date count }
          reviewsByDay { date count }
        } }`,
      );
      const analytics = res.body.data!.adminAnalytics;
      // Real cross-cutting data, not fixtures this test controls — assert
      // shape and sane values rather than exact counts.
      expect(analytics.decksPerCategory.length).toBeGreaterThan(0);
      expect(analytics.decksPerCategory.every((row) => row.deckCount > 0)).toBe(
        true,
      );
      expect(Array.isArray(analytics.topDecksByDownloads)).toBe(true);
      expect(Array.isArray(analytics.topDecksByRating)).toBe(true);
      // This test's own beforeAll registered two users today, so today must
      // appear in the signups series.
      const today = new Date().toISOString().slice(0, 10);
      expect(analytics.signupsByDay.some((row) => row.date === today)).toBe(
        true,
      );
      expect(
        analytics.signupsByDay.every((row) =>
          /^\d{4}-\d{2}-\d{2}$/.test(row.date),
        ),
      ).toBe(true);
    });
  });
});
