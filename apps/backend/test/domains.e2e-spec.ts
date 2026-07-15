import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * A genuine end-to-end test against the real local Postgres/Redis stack —
 * registers a user, adds a real domain, and exercises the real domain-
 * ownership verification endpoint (a real DNS TXT lookup, not mocked).
 */
describe('Domains (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const ownerEmail = `e2e-domains-owner-${Date.now()}@domecortex.dev`;
  const outsiderEmail = `e2e-domains-outsider-${Date.now()}@domecortex.dev`;

  let ownerToken: string;
  let outsiderToken: string;
  let organizationId: string;
  let domainId: string;

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
        name: 'Domains Owner',
        organizationName: `E2E Domains Org ${Date.now()}`,
      });
    ownerToken = ownerRes.body.accessToken;

    const outsiderRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: outsiderEmail,
        password: 'SuperSecret123!',
        name: 'Domains Outsider',
        organizationName: `E2E Domains Outsider Org ${Date.now()}`,
      });
    outsiderToken = outsiderRes.body.accessToken;

    const meRes = await request(app.getHttpServer())
      .get('/api/organizations/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    organizationId = meRes.body[0].id;

    const domainRes = await request(app.getHttpServer())
      .post('/api/domains')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ organizationId, name: 'example.com' });
    domainId = domainRes.body.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, outsiderEmail] } },
    });
    await app.close();
  });

  it('creates a new domain with a real verification token, unverified by default', async () => {
    const domain = await prisma.domain.findUnique({ where: { id: domainId } });
    expect(domain?.verified).toBe(false);
    expect(domain?.verificationToken).toBeTruthy();
  });

  it('does not let an outsider verify a domain it does not belong to', async () => {
    await request(app.getHttpServer())
      .patch(`/api/domains/${domainId}/verify`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('refuses to verify a real domain that does not actually have the TXT record', async () => {
    // example.com is a real domain this test does not control the DNS of —
    // it genuinely has no `domecortex-verify=...` TXT record, so this must
    // fail honestly rather than ever flipping `verified` to true.
    const res = await request(app.getHttpServer())
      .patch(`/api/domains/${domainId}/verify`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);

    expect(res.body.message).toMatch(/TXT record/i);

    const domain = await prisma.domain.findUnique({ where: { id: domainId } });
    expect(domain?.verified).toBe(false);
  }, 15_000);
});
