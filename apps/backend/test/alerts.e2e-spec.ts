import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * A genuine end-to-end test against the real local Postgres/Redis stack,
 * including the real BullMQ scan worker — not mocked. Registers a user,
 * adds a real domain, triggers a real scan (which, via `ScanProcessor`,
 * creates real `Alert` rows for the newly-discovered assets), and
 * exercises the alerts API against that real data.
 */
describe('Alerts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const ownerEmail = `e2e-alerts-owner-${Date.now()}@domecortex.dev`;
  const outsiderEmail = `e2e-alerts-outsider-${Date.now()}@domecortex.dev`;

  let ownerToken: string;
  let outsiderToken: string;
  let organizationId: string;

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
        name: 'Alerts Owner',
        organizationName: `E2E Alerts Org ${Date.now()}`,
      });
    ownerToken = ownerRes.body.accessToken;

    const outsiderRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: outsiderEmail,
        password: 'SuperSecret123!',
        name: 'Alerts Outsider',
        organizationName: `E2E Alerts Outsider Org ${Date.now()}`,
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

    await request(app.getHttpServer())
      .post('/api/scans')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ domainId: domainRes.body.id });

    // The scan (and its resulting Alert rows) is processed asynchronously
    // by the real BullMQ worker — poll for real completion rather than a
    // fixed sleep, same pattern used throughout this build's other
    // async-worker verifications.
    for (let attempt = 0; attempt < 15; attempt++) {
      const alerts = await prisma.alert.findMany({ where: { organizationId } });
      if (alerts.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }, 30_000);

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, outsiderEmail] } },
    });
    await app.close();
  });

  it('created real Alert rows as a side effect of the real scan', async () => {
    const alerts = await prisma.alert.findMany({ where: { organizationId } });
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('lets an org member list the real alerts', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/alerts?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].read).toBe(false);
  });

  it('does not let an outsider (not a member of the org) list its alerts', async () => {
    await request(app.getHttpServer())
      .get(`/api/alerts?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('lets a member mark a single alert as read', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/alerts?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const alertId = list.body[0].id;

    const res = await request(app.getHttpServer())
      .patch(`/api/alerts/${alertId}/read`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.read).toBe(true);
  });

  it("does not let an outsider mark someone else's alert as read", async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/alerts?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const alertId =
      list.body.find((a: { read: boolean }) => !a.read)?.id ?? list.body[0].id;

    await request(app.getHttpServer())
      .patch(`/api/alerts/${alertId}/read`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('marks every remaining unread alert as read in one call', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/alerts/read-all?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.updated).toBeGreaterThanOrEqual(0);

    const list = await request(app.getHttpServer())
      .get(`/api/alerts?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.body.every((a: { read: boolean }) => a.read)).toBe(true);
  });
});
