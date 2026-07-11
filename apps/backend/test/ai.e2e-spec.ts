import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * A genuine end-to-end test against the real local Postgres/Redis stack —
 * registers a user, adds a real domain, runs a real scan to get a real
 * finding, then exercises the AI endpoints. This build environment has no
 * real `AI_API_KEY` (see `ai.service.ts`), so the honest, correct behavior
 * to verify here is the real 503 "not configured" response — not
 * fabricated AI output, which this test suite has no way to produce
 * legitimately anyway.
 */
describe('AI (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const ownerEmail = `e2e-ai-owner-${Date.now()}@sentinelai.dev`;
  const outsiderEmail = `e2e-ai-outsider-${Date.now()}@sentinelai.dev`;

  let ownerToken: string;
  let outsiderToken: string;
  let organizationId: string;
  let scanId: string;
  let findingId: string;

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
        name: 'AI Owner',
        organizationName: `E2E AI Org ${Date.now()}`,
      });
    ownerToken = ownerRes.body.accessToken;

    const outsiderRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: outsiderEmail,
        password: 'SuperSecret123!',
        name: 'AI Outsider',
        organizationName: `E2E AI Outsider Org ${Date.now()}`,
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

    for (let attempt = 0; attempt < 20; attempt++) {
      const scan = await prisma.scan.findFirst({
        where: { domainId: domainRes.body.id, status: 'COMPLETED' },
        include: { findings: true },
      });
      if (scan) {
        scanId = scan.id;
        findingId = scan.findings[0]?.id;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }, 30_000);

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, outsiderEmail] } },
    });
    await app.close();
  });

  it('produced a real finding to analyze', () => {
    expect(scanId).toBeTruthy();
    expect(findingId).toBeTruthy();
  });

  it('honestly reports 503 when analyzing a finding without a real AI key configured', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/ai/findings/${findingId}/analyze`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(503);

    expect(res.body.message).toMatch(/AI_API_KEY/);

    // Confirms the honest-failure path never wrote fabricated content.
    const finding = await prisma.finding.findUnique({
      where: { id: findingId },
    });
    expect(finding?.aiExplanation).toBeNull();
  });

  it('does not let an outsider analyze a finding it has no access to', async () => {
    await request(app.getHttpServer())
      .post(`/api/ai/findings/${findingId}/analyze`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('honestly reports 503 for an executive summary without a real AI key configured', async () => {
    await request(app.getHttpServer())
      .post(`/api/ai/scans/${scanId}/executive-summary`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(503);
  });

  it('does not let an outsider request an executive summary for a scan it has no access to', async () => {
    await request(app.getHttpServer())
      .post(`/api/ai/scans/${scanId}/executive-summary`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });
});
