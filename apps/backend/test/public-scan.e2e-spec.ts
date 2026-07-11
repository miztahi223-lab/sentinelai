import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * A genuine end-to-end test against the real, unauthenticated free-scan
 * endpoint the landing page's lead-gen widget calls — real DNS/TLS/HTTP
 * probes against a real, stable public domain (`example.com`, the same
 * real target other e2e suites in this codebase already probe), no
 * authentication, nothing persisted.
 */
describe('PublicScan (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs a real scan against a real domain with no authentication required', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/public-scan')
      .send({ domain: 'example.com' })
      .expect(200);

    expect(res.body.domain).toBe('example.com');
    expect(res.body.reachable).toBe(true);
    expect(typeof res.body.score).toBe('number');
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);
    expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'STRONG']).toContain(
      res.body.riskLevel,
    );
    expect(typeof res.body.additionalFindingsCount).toBe('number');
  }, 30_000);

  it('rejects a malformed hostname before ever attempting a probe', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/public-scan')
      .send({ domain: '<script>alert(1)</script>' })
      .expect(400);

    expect(res.body.message).toBeDefined();
  });

  it('rejects a request with no domain at all', async () => {
    await request(app.getHttpServer())
      .post('/api/public-scan')
      .send({})
      .expect(400);
  });
});
