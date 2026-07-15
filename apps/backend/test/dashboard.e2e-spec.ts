import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * A genuine end-to-end test against the real local Postgres/Redis stack —
 * registers a user, adds a real domain, runs a real scan (via the real
 * BullMQ worker), and confirms the dashboard summary endpoint reports real
 * numbers derived from that real scan's Assets/Findings/Alerts, not
 * placeholders.
 */
describe('Dashboard summary (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const ownerEmail = `e2e-dashboard-owner-${Date.now()}@domecortex.dev`;
  const outsiderEmail = `e2e-dashboard-outsider-${Date.now()}@domecortex.dev`;

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
        name: 'Dashboard Owner',
        organizationName: `E2E Dashboard Org ${Date.now()}`,
      });
    ownerToken = ownerRes.body.accessToken;

    const outsiderRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: outsiderEmail,
        password: 'SuperSecret123!',
        name: 'Dashboard Outsider',
        organizationName: `E2E Dashboard Outsider Org ${Date.now()}`,
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

    await request(app.getHttpServer())
      .post('/api/scans')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ domainId });

    // The scan runs asynchronously via the real BullMQ worker — poll for
    // real completion rather than a fixed sleep, same pattern used
    // throughout this build's other async-worker verifications.
    for (let attempt = 0; attempt < 15; attempt++) {
      const scan = await prisma.scan.findFirst({
        where: { domainId, status: 'COMPLETED' },
      });
      if (scan) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }, 30_000);

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, outsiderEmail] } },
    });
    await app.close();
  });

  it('reports real counts derived from the real scan', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/dashboard/summary?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.totalDomains).toBe(1);
    expect(res.body.totalAssets).toBeGreaterThan(0);
    expect(res.body.latestScan).not.toBeNull();
    expect(res.body.latestScan.domainName).toBe('example.com');
    expect(Array.isArray(res.body.topRisks)).toBe(true);
    expect(Array.isArray(res.body.upcomingCertExpirations)).toBe(true);
    expect(Array.isArray(res.body.recentChanges)).toBe(true);
    // Every real Alert the scan produced starts unread.
    expect(res.body.activeAlertsCount).toBeGreaterThan(0);
    expect(res.body.resolvedAlertsCount).toBe(0);
  });

  it('does not let an outsider (not a member of the org) read its summary', async () => {
    await request(app.getHttpServer())
      .get(`/api/dashboard/summary?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('reflects a real read/unread split once alerts are marked read', async () => {
    await request(app.getHttpServer())
      .patch(`/api/alerts/read-all?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/api/dashboard/summary?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.activeAlertsCount).toBe(0);
    expect(res.body.resolvedAlertsCount).toBeGreaterThan(0);
  });
});
