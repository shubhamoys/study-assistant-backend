import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
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

const TEST_EMAIL = 'e2e-auth-test@example.com';
const TEST_PASSWORD = 'password123';

function gql(query: string) {
  return { query };
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    await userRepository.delete({ email: TEST_EMAIL });
  });

  afterAll(async () => {
    await userRepository.delete({ email: TEST_EMAIL });
    await app.close();
  });

  it('rejects registration with an invalid email and a too-short password', async () => {
    const res: GraphQLResponse<null> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "not-an-email", password: "short" }) { accessToken } }`,
        ),
      );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
  });

  it('registers a new user and returns an access token', async () => {
    const res: GraphQLResponse<{
      register: { accessToken: string; user: { email: string; role: string } };
    }> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}" }) { accessToken user { email role } } }`,
        ),
      );

    expect(res.body.data?.register.accessToken).toEqual(expect.any(String));
    expect(res.body.data?.register.user).toEqual({
      email: TEST_EMAIL,
      role: 'USER',
    });
  });

  it('rejects registering the same email twice', async () => {
    const res: GraphQLResponse<null> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}" }) { accessToken } }`,
        ),
      );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('CONFLICT');
  });

  it('rejects login with the wrong password', async () => {
    const res: GraphQLResponse<null> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { login(input: { email: "${TEST_EMAIL}", password: "wrong-password" }) { accessToken } }`,
        ),
      );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('logs in with the correct password and can query `me` with the returned token', async () => {
    const loginRes: GraphQLResponse<{ login: { accessToken: string } }> =
      await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { login(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}" }) { accessToken } }`,
          ),
        );

    const token = loginRes.body.data?.login.accessToken;
    expect(token).toEqual(expect.any(String));

    const meRes: GraphQLResponse<{ me: { email: string } }> = await request(
      app.getHttpServer(),
    )
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql(`{ me { email } }`));

    expect(meRes.body.data?.me.email).toBe(TEST_EMAIL);
  });

  it('rejects `me` without a token', async () => {
    const res: GraphQLResponse<null> = await request(app.getHttpServer())
      .post('/graphql')
      .send(gql(`{ me { email } }`));

    expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('rejects `me` with a garbage token', async () => {
    const res: GraphQLResponse<null> = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', 'Bearer garbage.token.here')
      .send(gql(`{ me { email } }`));

    expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });
});
