import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * A genuine end-to-end test against the real local Postgres/Redis stack.
 * Covers the two account-management actions that were previously entirely
 * missing from the product: updating your display name, and changing your
 * password from an authenticated session (distinct from the unauthenticated
 * forgot-password/reset-password email flow already covered elsewhere).
 */
describe('Users (e2e)', () => {
  let app: INestApplication<App>;

  const email = `e2e-users-${Date.now()}@domecortex.dev`;
  const originalPassword = 'SuperSecret123!';
  let accessToken: string;
  let refreshToken: string;

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

    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: originalPassword,
        name: 'Original Name',
        organizationName: `E2E Users Org ${Date.now()}`,
      });
    accessToken = registerRes.body.accessToken;
    refreshToken = registerRes.body.refreshToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an anonymous (no-token) profile update', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .send({ name: 'Nope' })
      .expect(401);
  });

  it('updates the display name for real, reflected in GET /auth/me', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated Name' })
      .expect(200);
    expect(res.body.name).toBe('Updated Name');

    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(meRes.body.name).toBe('Updated Name');
  });

  it('refuses to change the password with the wrong current password', async () => {
    await request(app.getHttpServer())
      .post('/api/users/me/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'TotallyWrong123!',
        newPassword: 'BrandNewPassword456!',
      })
      .expect(401);
  });

  it('changes the password for real when the current password is correct, and revokes existing sessions', async () => {
    await request(app.getHttpServer())
      .post('/api/users/me/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: originalPassword,
        newPassword: 'BrandNewPassword456!',
      })
      .expect(201);

    // The old refresh token (issued before the password change) must now
    // be revoked — the whole point of invalidating sessions on a password
    // change.
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    // The old password no longer works...
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: originalPassword })
      .expect(401);

    // ...but the new one does, proving the hash was genuinely updated (not
    // just an in-memory/mocked change).
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'BrandNewPassword456!' })
      .expect(200);
  });
});
