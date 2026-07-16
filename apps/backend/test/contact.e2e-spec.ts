import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * A genuine end-to-end test against the real local Postgres/Redis stack.
 * The real thing being verified here is durability: a contact-form
 * submission must leave a real `ContactMessage` row behind regardless of
 * whether the notification email succeeds — see the comment on
 * `ContactController.submit` for the real failure mode (an SMTP outage)
 * this exists to close. This build environment has no SMTP_HOST
 * configured, so `EmailService` takes its own "log instead of send"
 * path — the assertion here is on the row actually being persisted and
 * the endpoint never surfacing an email-layer problem as a failed
 * submission, not on the email transport itself.
 */
describe('Contact (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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
    await app.close();
  });

  it('persists a valid submission and returns success', async () => {
    const email = `e2e-contact-${Date.now()}@domecortex.dev`;
    const res = await request(app.getHttpServer())
      .post('/api/contact')
      .send({
        name: 'E2E Contact',
        email,
        subject: 'A real question',
        message: 'Does this actually get saved?',
      })
      .expect(200);

    expect(res.body).toEqual({ success: true });

    const saved = await prisma.contactMessage.findFirst({ where: { email } });
    expect(saved).not.toBeNull();
    expect(saved?.subject).toBe('A real question');
    expect(saved?.message).toBe('Does this actually get saved?');
  });

  it('rejects an invalid submission and persists nothing for it', async () => {
    await request(app.getHttpServer())
      .post('/api/contact')
      .send({
        name: 'E2E Contact',
        email: 'not-an-email',
        subject: 'A real question',
        message: 'x',
      })
      .expect(400);

    const saved = await prisma.contactMessage.findFirst({
      where: { email: 'not-an-email' },
    });
    expect(saved).toBeNull();
  });
});
