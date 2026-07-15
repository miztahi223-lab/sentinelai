import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * A genuine end-to-end test against the real local Postgres/Redis stack.
 * Exercises the real audit trail this session added: registering, adding
 * a domain, and inviting a teammate should each leave a real `AuditLog`
 * row behind, readable only by an OWNER/ADMIN of the organization.
 */
describe('Audit logs (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const ownerEmail = `e2e-audit-owner-${Date.now()}@domecortex.dev`;
  const memberEmail = `e2e-audit-member-${Date.now()}@domecortex.dev`;

  let ownerToken: string;
  let memberToken: string;
  let organizationId: string;
  let ownerUserId: string;

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
        name: 'Audit Owner',
        organizationName: `E2E Audit Org ${Date.now()}`,
      });
    ownerToken = ownerRes.body.accessToken;
    ownerUserId = ownerRes.body.user.id;

    const meRes = await request(app.getHttpServer())
      .get('/api/organizations/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    organizationId = meRes.body[0].id;

    // A real login (separate from the registration above) so
    // `user.login` has a genuine second event to check for, not just
    // `user.registered`.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ownerEmail, password: 'SuperSecret123!' });

    await request(app.getHttpServer())
      .post('/api/domains')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ organizationId, name: 'audit-log-test-domain.example' });

    const memberRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: memberEmail,
        password: 'SuperSecret123!',
        name: 'Audit Member',
        organizationName: `E2E Audit Member Org ${Date.now()}`,
      });
    memberToken = memberRes.body.accessToken;

    const invitation = await request(app.getHttpServer())
      .post('/api/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ organizationId, email: memberEmail, role: 'MEMBER' });

    await request(app.getHttpServer())
      .post(`/api/invitations/${invitation.body.token}/accept`)
      .set('Authorization', `Bearer ${memberToken}`);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, memberEmail] } },
    });
    await app.close();
  });

  it('recorded a real audit log entry for registration', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { organizationId, action: 'user.registered' },
    });
    expect(logs.length).toBe(1);
  });

  it('recorded a real audit log entry for the login (not organization-scoped — a login happens before any specific org context, so it is keyed by user, not organizationId)', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { userId: ownerUserId, action: 'user.login' },
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it('recorded a real audit log entry for adding a domain, with the real domain name in metadata', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { organizationId, action: 'domain.added' },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].metadata).toMatchObject({
      name: 'audit-log-test-domain.example',
    });
  });

  it('recorded real audit log entries for the invitation being created and accepted', async () => {
    const created = await prisma.auditLog.findMany({
      where: { organizationId, action: 'invitation.created' },
    });
    const accepted = await prisma.auditLog.findMany({
      where: { organizationId, action: 'invitation.accepted' },
    });
    expect(created.length).toBe(1);
    expect(accepted.length).toBe(1);
  });

  it('lets an OWNER read the real audit log via the API', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/audit-logs?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const actions = res.body.map((l: { action: string }) => l.action);
    expect(actions).toContain('user.registered');
    expect(actions).toContain('domain.added');
  });

  it('does not let a plain MEMBER read the audit log', async () => {
    await request(app.getHttpServer())
      .get(`/api/audit-logs?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });
});
