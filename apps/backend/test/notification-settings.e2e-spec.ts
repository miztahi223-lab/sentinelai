import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * A genuine end-to-end test against the real local Postgres/Redis stack —
 * confirms real membership authorization and real persistence for an
 * organization's notification channel settings (webhook/Slack URLs,
 * digest toggles).
 */
describe('NotificationSettings (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const ownerEmail = `e2e-notif-owner-${Date.now()}@domecortex.dev`;
  const outsiderEmail = `e2e-notif-outsider-${Date.now()}@domecortex.dev`;

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
        name: 'Notif Owner',
        organizationName: `E2E Notif Org ${Date.now()}`,
      });
    ownerToken = ownerRes.body.accessToken;

    const outsiderRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: outsiderEmail,
        password: 'SuperSecret123!',
        name: 'Notif Outsider',
        organizationName: `E2E Notif Outsider Org ${Date.now()}`,
      });
    outsiderToken = outsiderRes.body.accessToken;

    const meRes = await request(app.getHttpServer())
      .get('/api/organizations/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    organizationId = meRes.body[0].id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, outsiderEmail] } },
    });
    await app.close();
  });

  it('returns real (empty) defaults for an org that has never configured anything', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/notification-settings?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.webhookUrl).toBeNull();
    expect(res.body.slackWebhookUrl).toBeNull();
    expect(res.body.dailyDigestEnabled).toBe(false);
    expect(res.body.weeklyDigestEnabled).toBe(false);
  });

  it('does not let an outsider read this organization notification settings', async () => {
    await request(app.getHttpServer())
      .get(`/api/notification-settings?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('lets the owner persist real webhook/Slack URLs and digest toggles', async () => {
    const updateRes = await request(app.getHttpServer())
      .patch(`/api/notification-settings?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        webhookUrl: 'https://example.com/webhook',
        slackWebhookUrl: 'https://hooks.slack.example/services/x',
        dailyDigestEnabled: true,
      })
      .expect(200);

    expect(updateRes.body.webhookUrl).toBe('https://example.com/webhook');
    expect(updateRes.body.dailyDigestEnabled).toBe(true);

    const getRes = await request(app.getHttpServer())
      .get(`/api/notification-settings?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(getRes.body.webhookUrl).toBe('https://example.com/webhook');
    expect(getRes.body.slackWebhookUrl).toBe(
      'https://hooks.slack.example/services/x',
    );
    expect(getRes.body.dailyDigestEnabled).toBe(true);
    expect(getRes.body.weeklyDigestEnabled).toBe(false);
  });

  it('rejects a non-HTTPS webhook URL', async () => {
    await request(app.getHttpServer())
      .patch(`/api/notification-settings?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ webhookUrl: 'http://example.com/webhook' })
      .expect(400);
  });

  it('does not let an outsider update this organization notification settings', async () => {
    await request(app.getHttpServer())
      .patch(`/api/notification-settings?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ dailyDigestEnabled: true })
      .expect(403);
  });
});
