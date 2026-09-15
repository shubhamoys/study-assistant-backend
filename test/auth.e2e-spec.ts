import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { User } from '../src/app-modules/users/entities/user.entity';
import { MailService } from '../src/shared/mail/mail.service';

interface GraphQLResponse<T> {
  body: {
    data: T | null;
    errors?: { message: string; extensions?: { code?: string } }[];
  };
}

const TEST_EMAIL = 'e2e-auth-test@example.com';
const TEST_PASSWORD = 'password123';
const TEST_DISPLAY_NAME = 'Test User';

function gql(query: string) {
  return { query };
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let mailService: MailService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    mailService = moduleFixture.get(MailService);
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
          `mutation { register(input: { email: "not-an-email", password: "short", displayName: "${TEST_DISPLAY_NAME}" }) { accessToken } }`,
        ),
      );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
  });

  it('registers a new user and returns an access token + refresh token', async () => {
    const res: GraphQLResponse<{
      register: {
        accessToken: string;
        refreshToken: string;
        user: { email: string; role: string; displayName: string };
      };
    }> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}", displayName: "${TEST_DISPLAY_NAME}" }) { accessToken refreshToken user { email role displayName } } }`,
        ),
      );

    expect(res.body.data?.register.accessToken).toEqual(expect.any(String));
    expect(res.body.data?.register.refreshToken).toEqual(expect.any(String));
    expect(res.body.data?.register.user).toEqual({
      email: TEST_EMAIL,
      role: 'USER',
      displayName: TEST_DISPLAY_NAME,
    });
  });

  it('rejects registering without a display name', async () => {
    const res: GraphQLResponse<null> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "not-registered-yet@example.com", password: "${TEST_PASSWORD}", displayName: "" }) { accessToken } }`,
        ),
      );

    expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
  });

  it('rejects registering the same email twice', async () => {
    const res: GraphQLResponse<null> = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          `mutation { register(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}", displayName: "${TEST_DISPLAY_NAME}" }) { accessToken } }`,
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

  describe('refresh tokens', () => {
    it('rotates on use, and rejects reuse of the old token', async () => {
      const loginRes: GraphQLResponse<{
        login: { refreshToken: string };
      }> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { login(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}" }) { refreshToken } }`,
          ),
        );
      const oldToken = loginRes.body.data!.login.refreshToken;

      const refreshRes: GraphQLResponse<{
        refreshToken: { accessToken: string; refreshToken: string };
      }> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { refreshToken(refreshToken: "${oldToken}") { accessToken refreshToken } }`,
          ),
        );
      expect(refreshRes.body.data?.refreshToken.accessToken).toEqual(
        expect.any(String),
      );
      const newToken = refreshRes.body.data!.refreshToken.refreshToken;
      expect(newToken).not.toBe(oldToken);

      const reuseRes: GraphQLResponse<null> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { refreshToken(refreshToken: "${oldToken}") { accessToken } }`,
          ),
        );
      expect(reuseRes.body.errors?.[0]?.extensions?.code).toBe(
        'UNAUTHENTICATED',
      );
    });

    it('rejects a garbage refresh token', async () => {
      const res: GraphQLResponse<null> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { refreshToken(refreshToken: "garbage") { accessToken } }`,
          ),
        );

      expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('logout', () => {
    it('revokes the given refresh token', async () => {
      const loginRes: GraphQLResponse<{
        login: { accessToken: string; refreshToken: string };
      }> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { login(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}" }) { accessToken refreshToken } }`,
          ),
        );
      const { accessToken, refreshToken } = loginRes.body.data!.login;

      const logoutRes: GraphQLResponse<{ logout: boolean }> = await request(
        app.getHttpServer(),
      )
        .post('/graphql')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(gql(`mutation { logout(refreshToken: "${refreshToken}") }`));
      expect(logoutRes.body.data?.logout).toBe(true);

      const reuseRes: GraphQLResponse<null> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { refreshToken(refreshToken: "${refreshToken}") { accessToken } }`,
          ),
        );
      expect(reuseRes.body.errors?.[0]?.extensions?.code).toBe(
        'UNAUTHENTICATED',
      );
    });
  });

  describe('verifyEmail', () => {
    it('marks the user verified given the token sent at registration', async () => {
      const sendSpy = jest
        .spyOn(mailService, 'sendVerificationEmail')
        .mockResolvedValue(undefined);

      const email = 'e2e-verify-test@example.com';
      await userRepository.delete({ email });
      await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { register(input: { email: "${email}", password: "${TEST_PASSWORD}", displayName: "${TEST_DISPLAY_NAME}" }) { accessToken } }`,
          ),
        );

      const rawToken = sendSpy.mock.calls[0][1];
      sendSpy.mockRestore();

      const verifyRes: GraphQLResponse<{ verifyEmail: boolean }> =
        await request(app.getHttpServer())
          .post('/graphql')
          .send(gql(`mutation { verifyEmail(token: "${rawToken}") }`));
      expect(verifyRes.body.data?.verifyEmail).toBe(true);

      const user = await userRepository.findOneBy({ email });
      expect(user?.isEmailVerified).toBe(true);
      expect(user?.verificationToken).toBeNull();

      await userRepository.delete({ email });
    });

    it('rejects an invalid token', async () => {
      const res: GraphQLResponse<null> = await request(app.getHttpServer())
        .post('/graphql')
        .send(gql(`mutation { verifyEmail(token: "not-a-real-token") }`));

      expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
    });
  });

  describe('resendVerificationEmail', () => {
    const email = 'e2e-resend-verify-test@example.com';

    afterEach(async () => {
      await userRepository.delete({ email });
    });

    it('resends while the account is unverified', async () => {
      const sendSpy = jest
        .spyOn(mailService, 'sendVerificationEmail')
        .mockResolvedValue(undefined);

      const registerRes: GraphQLResponse<{
        register: { accessToken: string };
      }> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { register(input: { email: "${email}", password: "${TEST_PASSWORD}", displayName: "${TEST_DISPLAY_NAME}" }) { accessToken } }`,
          ),
        );
      const { accessToken } = registerRes.body.data!.register;
      sendSpy.mockClear(); // ignore the email registration itself already sent

      const res: GraphQLResponse<{ resendVerificationEmail: boolean }> =
        await request(app.getHttpServer())
          .post('/graphql')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(gql(`mutation { resendVerificationEmail }`));
      expect(res.body.data?.resendVerificationEmail).toBe(true);
      expect(sendSpy).toHaveBeenCalledWith(email, expect.any(String));

      sendSpy.mockRestore();
    });

    it('sends a token that supersedes the one from registration', async () => {
      const sendSpy = jest
        .spyOn(mailService, 'sendVerificationEmail')
        .mockResolvedValue(undefined);

      const registerRes: GraphQLResponse<{
        register: { accessToken: string };
      }> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { register(input: { email: "${email}", password: "${TEST_PASSWORD}", displayName: "${TEST_DISPLAY_NAME}" }) { accessToken } }`,
          ),
        );
      const { accessToken } = registerRes.body.data!.register;
      const registrationToken = sendSpy.mock.calls[0][1];

      await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(gql(`mutation { resendVerificationEmail }`));
      const resentToken = sendSpy.mock.calls[1][1];
      sendSpy.mockRestore();

      expect(resentToken).not.toBe(registrationToken);

      const oldTokenRes: GraphQLResponse<null> = await request(
        app.getHttpServer(),
      )
        .post('/graphql')
        .send(gql(`mutation { verifyEmail(token: "${registrationToken}") }`));
      expect(oldTokenRes.body.errors?.[0]?.extensions?.code).toBe(
        'BAD_REQUEST',
      );

      const newTokenRes: GraphQLResponse<{ verifyEmail: boolean }> =
        await request(app.getHttpServer())
          .post('/graphql')
          .send(gql(`mutation { verifyEmail(token: "${resentToken}") }`));
      expect(newTokenRes.body.data?.verifyEmail).toBe(true);
    });

    it('is a no-op once the account is already verified', async () => {
      const sendSpy = jest
        .spyOn(mailService, 'sendVerificationEmail')
        .mockResolvedValue(undefined);

      const registerRes: GraphQLResponse<{
        register: { accessToken: string };
      }> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { register(input: { email: "${email}", password: "${TEST_PASSWORD}", displayName: "${TEST_DISPLAY_NAME}" }) { accessToken } }`,
          ),
        );
      const { accessToken } = registerRes.body.data!.register;
      const rawToken = sendSpy.mock.calls[0][1];
      sendSpy.mockClear();

      await request(app.getHttpServer())
        .post('/graphql')
        .send(gql(`mutation { verifyEmail(token: "${rawToken}") }`));

      const res: GraphQLResponse<{ resendVerificationEmail: boolean }> =
        await request(app.getHttpServer())
          .post('/graphql')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(gql(`mutation { resendVerificationEmail }`));
      expect(res.body.data?.resendVerificationEmail).toBe(true);
      expect(sendSpy).not.toHaveBeenCalled();

      sendSpy.mockRestore();
    });

    it('requires auth', async () => {
      const res: GraphQLResponse<null> = await request(app.getHttpServer())
        .post('/graphql')
        .send(gql(`mutation { resendVerificationEmail }`));

      expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('rejects a second resend within the 2-minute cooldown', async () => {
      const sendSpy = jest
        .spyOn(mailService, 'sendVerificationEmail')
        .mockResolvedValue(undefined);

      const registerRes: GraphQLResponse<{
        register: { accessToken: string };
      }> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { register(input: { email: "${email}", password: "${TEST_PASSWORD}", displayName: "${TEST_DISPLAY_NAME}" }) { accessToken } }`,
          ),
        );
      const { accessToken } = registerRes.body.data!.register;

      await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(gql(`mutation { resendVerificationEmail }`));
      sendSpy.mockClear();

      const res: GraphQLResponse<null> = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(gql(`mutation { resendVerificationEmail }`));

      expect(res.body.errors?.[0]?.extensions?.code).toBe('TOO_MANY_REQUESTS');
      expect(sendSpy).not.toHaveBeenCalled();

      sendSpy.mockRestore();
    });

    it('allows a resend once the cooldown window has elapsed', async () => {
      const sendSpy = jest
        .spyOn(mailService, 'sendVerificationEmail')
        .mockResolvedValue(undefined);

      const registerRes: GraphQLResponse<{
        register: { accessToken: string };
      }> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { register(input: { email: "${email}", password: "${TEST_PASSWORD}", displayName: "${TEST_DISPLAY_NAME}" }) { accessToken } }`,
          ),
        );
      const { accessToken } = registerRes.body.data!.register;

      await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(gql(`mutation { resendVerificationEmail }`));
      sendSpy.mockClear();

      // Simulate the cooldown having already elapsed rather than waiting 2
      // real minutes in the test.
      await userRepository.update(
        { email },
        { verificationEmailSentAt: new Date(Date.now() - 3 * 60 * 1000) },
      );

      const res: GraphQLResponse<{ resendVerificationEmail: boolean }> =
        await request(app.getHttpServer())
          .post('/graphql')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(gql(`mutation { resendVerificationEmail }`));

      expect(res.body.data?.resendVerificationEmail).toBe(true);
      expect(sendSpy).toHaveBeenCalledWith(email, expect.any(String));

      sendSpy.mockRestore();
    });
  });

  describe('forgotPassword / resetPassword', () => {
    it('resets the password and revokes existing refresh tokens', async () => {
      const loginRes: GraphQLResponse<{
        login: { refreshToken: string };
      }> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { login(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}" }) { refreshToken } }`,
          ),
        );
      const existingRefreshToken = loginRes.body.data!.login.refreshToken;

      const sendSpy = jest
        .spyOn(mailService, 'sendPasswordResetEmail')
        .mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/graphql')
        .send(gql(`mutation { forgotPassword(email: "${TEST_EMAIL}") }`));

      const rawToken = sendSpy.mock.calls[0][1];
      sendSpy.mockRestore();

      const newPassword = 'a-brand-new-password';
      const resetRes: GraphQLResponse<{ resetPassword: boolean }> =
        await request(app.getHttpServer())
          .post('/graphql')
          .send(
            gql(
              `mutation { resetPassword(input: { token: "${rawToken}", newPassword: "${newPassword}" }) }`,
            ),
          );
      expect(resetRes.body.data?.resetPassword).toBe(true);

      // Old refresh token issued before the reset must now be dead.
      const reuseRes: GraphQLResponse<null> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { refreshToken(refreshToken: "${existingRefreshToken}") { accessToken } }`,
          ),
        );
      expect(reuseRes.body.errors?.[0]?.extensions?.code).toBe(
        'UNAUTHENTICATED',
      );

      // New password logs in; restore TEST_PASSWORD for the other tests.
      const loginNew: GraphQLResponse<{ login: { accessToken: string } }> =
        await request(app.getHttpServer())
          .post('/graphql')
          .send(
            gql(
              `mutation { login(input: { email: "${TEST_EMAIL}", password: "${newPassword}" }) { accessToken } }`,
            ),
          );
      expect(loginNew.body.data?.login.accessToken).toEqual(expect.any(String));

      await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { changePassword(input: { currentPassword: "${newPassword}", newPassword: "${TEST_PASSWORD}" }) }`,
          ),
        )
        .set(
          'Authorization',
          `Bearer ${loginNew.body.data!.login.accessToken}`,
        );
    });

    it('forgotPassword does not reveal whether the email exists', async () => {
      const res: GraphQLResponse<{ forgotPassword: boolean }> = await request(
        app.getHttpServer(),
      )
        .post('/graphql')
        .send(
          gql(`mutation { forgotPassword(email: "no-such-user@example.com") }`),
        );
      expect(res.body.data?.forgotPassword).toBe(true);
    });

    it('rejects an invalid/expired reset token', async () => {
      const res: GraphQLResponse<null> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { resetPassword(input: { token: "not-a-real-token", newPassword: "whatever123" }) }`,
          ),
        );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
    });
  });

  describe('changePassword', () => {
    it('rejects the wrong current password', async () => {
      const loginRes: GraphQLResponse<{
        login: { accessToken: string };
      }> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { login(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}" }) { accessToken } }`,
          ),
        );
      const { accessToken } = loginRes.body.data!.login;

      const res: GraphQLResponse<null> = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(
          gql(
            `mutation { changePassword(input: { currentPassword: "wrong-password", newPassword: "whatever123" }) }`,
          ),
        );
      expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('changes the password and revokes existing refresh tokens', async () => {
      const loginRes: GraphQLResponse<{
        login: { accessToken: string; refreshToken: string };
      }> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { login(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}" }) { accessToken refreshToken } }`,
          ),
        );
      const { accessToken, refreshToken } = loginRes.body.data!.login;

      const newPassword = 'yet-another-password';
      const changeRes: GraphQLResponse<{ changePassword: boolean }> =
        await request(app.getHttpServer())
          .post('/graphql')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(
            gql(
              `mutation { changePassword(input: { currentPassword: "${TEST_PASSWORD}", newPassword: "${newPassword}" }) }`,
            ),
          );
      expect(changeRes.body.data?.changePassword).toBe(true);

      const reuseRes: GraphQLResponse<null> = await request(app.getHttpServer())
        .post('/graphql')
        .send(
          gql(
            `mutation { refreshToken(refreshToken: "${refreshToken}") { accessToken } }`,
          ),
        );
      expect(reuseRes.body.errors?.[0]?.extensions?.code).toBe(
        'UNAUTHENTICATED',
      );

      // Restore TEST_PASSWORD so later test runs against the same DB row
      // (this suite doesn't delete the user between individual tests) stay
      // consistent.
      const loginNew: GraphQLResponse<{ login: { accessToken: string } }> =
        await request(app.getHttpServer())
          .post('/graphql')
          .send(
            gql(
              `mutation { login(input: { email: "${TEST_EMAIL}", password: "${newPassword}" }) { accessToken } }`,
            ),
          );
      await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${loginNew.body.data!.login.accessToken}`)
        .send(
          gql(
            `mutation { changePassword(input: { currentPassword: "${newPassword}", newPassword: "${TEST_PASSWORD}" }) }`,
          ),
        );
    });
  });
});
