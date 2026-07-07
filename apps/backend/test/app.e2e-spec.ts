import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * A genuine end-to-end test: boots the real `AppModule` (real Postgres via
 * the docker-compose stack, real Redis for BullMQ) and drives the actual
 * HTTP layer via supertest, the same way a real client would — not a unit
 * test with mocked dependencies. Requires the local dev stack
 * (`docker compose up -d`) to be running, same as manual verification
 * throughout this build.
 */
describe('Auth flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const testEmail = `e2e-test-${Date.now()}@sentinelai.dev`;

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

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up the test user this suite creates so repeated runs don't
    // collide on the unique email constraint.
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
  });

  it('rejects registration with a too-short password (validation actually runs)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'short',
        name: 'E2E Test',
        organizationName: 'E2E Org',
      })
      .expect(400);
  });

  let accessToken: string;
  let refreshToken: string;

  it('registers a new user and returns a working token pair', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SuperSecret123!',
        name: 'E2E Test',
        organizationName: 'E2E Org',
      })
      .expect(201);

    expect(response.body.user.email).toBe(testEmail);
    expect(typeof response.body.accessToken).toBe('string');
    expect(typeof response.body.refreshToken).toBe('string');
    accessToken = response.body.accessToken;
    refreshToken = response.body.refreshToken;
  });

  it('rejects a duplicate registration with the same email', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SuperSecret123!',
        name: 'E2E Test',
        organizationName: 'E2E Org',
      })
      .expect(409);
  });

  it('rejects login with the wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'WrongPassword123!' })
      .expect(401);
  });

  it('logs in with the correct password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'SuperSecret123!' })
      .expect(200);

    expect(response.body.user.email).toBe(testEmail);
  });

  it('rejects /auth/me with no token', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('returns the authenticated user for /auth/me with a valid access token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.email).toBe(testEmail);
  });

  it('rotates the refresh token and the old one can no longer be used', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(typeof first.body.refreshToken).toBe('string');
    expect(first.body.refreshToken).not.toBe(refreshToken);

    // The theft-detection property, verified over real HTTP this time
    // (unit-tested in isolation in token.service.spec.ts): reusing the
    // already-rotated token must fail.
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
