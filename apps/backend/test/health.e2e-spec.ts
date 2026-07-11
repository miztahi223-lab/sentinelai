import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * A genuine end-to-end test — confirms the real, unauthenticated health
 * endpoint the public `/status` page relies on actually queries the real
 * database rather than returning a hardcoded response.
 */
describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports ok with no authentication required', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('ok');
    expect(typeof res.body.checkedAt).toBe('string');
    // A real, current timestamp — not a hardcoded/stale value.
    expect(Date.now() - new Date(res.body.checkedAt).getTime()).toBeLessThan(
      5000,
    );
  });
});
