import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * A genuine end-to-end test against the real local Postgres/Redis stack.
 * There is no real `COINBASE_COMMERCE_API_KEY` in this build environment
 * (same situation as Stripe), so the meaningful thing to verify for real
 * is: (1) authorization is enforced exactly like the Stripe checkout
 * endpoint (a MEMBER is forbidden, an OWNER passes authorization), and
 * (2) without real credentials the endpoint honestly reports "not
 * configured" (503) rather than fabricating a checkout URL — never a
 * fake payment link. There is also no anonymous/no-auth crypto checkout
 * path to test the absence of, by design (401 without a token, same as
 * every other billing endpoint).
 */
describe('Crypto billing (e2e)', () => {
  let app: INestApplication<App>;

  const ownerEmail = `e2e-crypto-owner-${Date.now()}@domecortex.dev`;
  const memberEmail = `e2e-crypto-member-${Date.now()}@domecortex.dev`;

  let ownerToken: string;
  let memberToken: string;
  let organizationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // `rawBody: true` is required here (not just in `main.ts`) for the
    // crypto-webhook signature-verification test below — NestJS's raw-body
    // capture is an option on `createNestApplication`/`NestFactory.create`
    // itself, not something inherited from the compiled `TestingModule`.
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    const ownerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: ownerEmail,
        password: 'SuperSecret123!',
        name: 'Crypto Owner',
        organizationName: `E2E Crypto Org ${Date.now()}`,
      });
    ownerToken = ownerRes.body.accessToken;

    const meRes = await request(app.getHttpServer())
      .get('/api/organizations/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    organizationId = meRes.body[0].id;

    const memberRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: memberEmail,
        password: 'SuperSecret123!',
        name: 'Crypto Member',
        organizationName: `E2E Crypto Member Org ${Date.now()}`,
      });
    memberToken = memberRes.body.accessToken;

    const inviteRes = await request(app.getHttpServer())
      .post('/api/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ organizationId, email: memberEmail, role: 'MEMBER' });

    await request(app.getHttpServer())
      .post(`/api/invitations/${inviteRes.body.token}/accept`)
      .set('Authorization', `Bearer ${memberToken}`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an anonymous (no-token) crypto checkout request — there is no anonymous payment path', async () => {
    await request(app.getHttpServer())
      .post('/api/billing/crypto-checkout-session')
      .send({ organizationId, plan: 'STARTER' })
      .expect(401);
  });

  it('forbids a plain MEMBER from starting a crypto checkout, same as Stripe checkout', async () => {
    await request(app.getHttpServer())
      .post('/api/billing/crypto-checkout-session')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ organizationId, plan: 'STARTER' })
      .expect(403);
  });

  it('rejects the BUSINESS plan for crypto checkout (custom pricing, contact sales instead)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/billing/crypto-checkout-session')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ organizationId, plan: 'BUSINESS' })
      .expect(400);
    expect(res.body.message).toMatch(/custom-priced/i);
  });

  it('an authorized OWNER passes authorization but gets an honest "not configured" error, never a fake checkout link', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/billing/crypto-checkout-session')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ organizationId, plan: 'STARTER' })
      .expect(503);
    expect(res.body.message).toMatch(/not configured/i);
    expect(res.body).not.toHaveProperty('url');
  });

  it('the crypto webhook endpoint requires no user auth (Coinbase can\'t present a JWT) but still honestly reports "not configured" without a real webhook secret', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/billing/crypto-webhook')
      .set('x-cc-webhook-signature', 'deadbeef')
      .send({ event: { type: 'charge:confirmed', data: {} } })
      .expect(503);
    expect(res.body.message).toMatch(/not configured/i);
  });
});
