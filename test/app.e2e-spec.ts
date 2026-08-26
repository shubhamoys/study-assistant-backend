import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('GraphQL API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('health query reports ok status and a connected database', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ health { status database } }' })
      .expect(200)
      .expect(
        (res: {
          body: { data: { health: { status: string; database: string } } };
        }) => {
          expect(res.body.data.health.status).toBe('ok');
          expect(res.body.data.health.database).toBe('up');
        },
      );
  });

  afterEach(async () => {
    await app.close();
  });
});
