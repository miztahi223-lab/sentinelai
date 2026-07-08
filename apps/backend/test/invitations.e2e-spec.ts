import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * A genuine end-to-end test against the real local Postgres/Redis stack —
 * same philosophy as app.e2e-spec.ts. Covers the full team-invitation flow:
 * an org owner invites a real second user by email, that user accepts, and
 * both authorization boundaries (only owners/admins can invite; only the
 * actual invited email can accept) are exercised for real over HTTP, not
 * mocked.
 */
describe('Team invitations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const ownerEmail = `e2e-owner-${Date.now()}@sentinelai.dev`;
  const inviteeEmail = `e2e-invitee-${Date.now()}@sentinelai.dev`;
  const outsiderEmail = `e2e-outsider-${Date.now()}@sentinelai.dev`;

  let ownerToken: string;
  let inviteeToken: string;
  let outsiderToken: string;
  let organizationId: string;
  let invitationToken: string;

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

    const ownerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: ownerEmail,
        password: 'SuperSecret123!',
        name: 'Owner',
        organizationName: `E2E Invite Org ${Date.now()}`,
      });
    ownerToken = ownerRes.body.accessToken;

    const meRes = await request(app.getHttpServer())
      .get('/api/organizations/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    organizationId = meRes.body[0].id;

    const inviteeRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: inviteeEmail,
        password: 'SuperSecret123!',
        name: 'Invitee',
        organizationName: `E2E Invitee Own Org ${Date.now()}`,
      });
    inviteeToken = inviteeRes.body.accessToken;

    const outsiderRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: outsiderEmail,
        password: 'SuperSecret123!',
        name: 'Outsider',
        organizationName: `E2E Outsider Org ${Date.now()}`,
      });
    outsiderToken = outsiderRes.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, inviteeEmail, outsiderEmail] } },
    });
    await app.close();
  });

  it('lets an OWNER invite someone by email', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ organizationId, email: inviteeEmail, role: 'MEMBER' })
      .expect(201);

    expect(res.body.email).toBe(inviteeEmail.toLowerCase());
    expect(res.body.role).toBe('MEMBER');
    invitationToken = res.body.token;
    expect(typeof invitationToken).toBe('string');
  });

  it('re-inviting an already-pending invitee replaces the invitation rather than erroring (upsert, not a duplicate row)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ organizationId, email: inviteeEmail, role: 'ADMIN' })
      .expect(201);

    // Re-inviting issues a fresh token (the old one is intentionally
    // invalidated) — every subsequent test must use *this* token, not the
    // one captured from the first invite above.
    invitationToken = res.body.token;
    expect(res.body.role).toBe('ADMIN');
  });

  it('does not let a non-owner/admin (someone outside the org entirely) invite', async () => {
    await request(app.getHttpServer())
      .post('/api/invitations')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ organizationId, email: 'someone-else@sentinelai.dev' })
      .expect(403);
  });

  it('shows the pending invitation to the owner', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/invitations?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(
      res.body.some(
        (inv: { email: string }) => inv.email === inviteeEmail.toLowerCase(),
      ),
    ).toBe(true);
  });

  it('lets the public token-lookup endpoint work with no auth', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/invitations/${invitationToken}`)
      .expect(200);

    expect(res.body.organization.name).toBeDefined();
  });

  it('refuses to let a different logged-in user accept an invitation addressed to someone else', async () => {
    await request(app.getHttpServer())
      .post(`/api/invitations/${invitationToken}/accept`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('lets the actual invited user accept the invitation, creating a real membership', async () => {
    await request(app.getHttpServer())
      .post(`/api/invitations/${invitationToken}/accept`)
      .set('Authorization', `Bearer ${inviteeToken}`)
      .expect(201);

    const membersRes = await request(app.getHttpServer())
      .get(`/api/invitations/members?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const emails = membersRes.body.map(
      (m: { user: { email: string } }) => m.user.email,
    );
    expect(emails).toContain(inviteeEmail.toLowerCase());
  });

  it('rejects reusing an already-accepted invitation token', async () => {
    await request(app.getHttpServer())
      .post(`/api/invitations/${invitationToken}/accept`)
      .set('Authorization', `Bearer ${inviteeToken}`)
      .expect(404);
  });
});
