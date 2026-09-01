import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { User } from '../src/app-modules/users/entities/user.entity';
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

describe('Admin (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    await userRepository.delete({ email: TEST_EMAIL_ADMIN });
    await userRepository.delete({ email: TEST_EMAIL_USER });

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
  });

  afterAll(async () => {
    await userRepository.delete({ email: TEST_EMAIL_ADMIN });
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
});
