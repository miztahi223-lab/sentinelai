import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { readFileSync } from 'fs';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * A genuine end-to-end test against the real local Postgres/Redis stack —
 * registers a user, adds a real domain, runs a real scan, then generates a
 * real PDF report (via the real BullMQ report worker/`pdfkit`, not mocked)
 * and confirms a real, well-formed PDF file lands on disk.
 */
describe('Reports (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const ownerEmail = `e2e-reports-owner-${Date.now()}@sentinelai.dev`;
  const outsiderEmail = `e2e-reports-outsider-${Date.now()}@sentinelai.dev`;

  let ownerToken: string;
  let outsiderToken: string;
  let organizationId: string;
  let reportId: string;
  let reportFilePath: string;

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
        name: 'Reports Owner',
        organizationName: `E2E Reports Org ${Date.now()}`,
      });
    ownerToken = ownerRes.body.accessToken;

    const outsiderRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: outsiderEmail,
        password: 'SuperSecret123!',
        name: 'Reports Outsider',
        organizationName: `E2E Reports Outsider Org ${Date.now()}`,
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
      });
      if (scan) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const reportRes = await request(app.getHttpServer())
      .post('/api/reports')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ organizationId });
    reportId = reportRes.body.id;

    for (let attempt = 0; attempt < 20; attempt++) {
      const report = await prisma.report.findUnique({
        where: { id: reportId },
      });
      if (report?.fileUrl) {
        reportFilePath = report.fileUrl;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }, 45_000);

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, outsiderEmail] } },
    });
    await app.close();
  });

  it('generated a real, well-formed PDF file on disk', () => {
    expect(reportFilePath).toBeTruthy();
    const bytes = readFileSync(reportFilePath);
    // The real PDF magic header — confirms this is a genuine PDF file, not
    // an empty or corrupt stub.
    expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    // A branded, multi-section report (header, executive summary, score,
    // category breakdown, assets, findings, recommendations) is
    // necessarily more than a trivial empty-page PDF.
    expect(bytes.length).toBeGreaterThan(2000);
  });

  it('lets the owner download the real report file', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/${reportId}/download`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('does not let an outsider download a report it has no access to', async () => {
    await request(app.getHttpServer())
      .get(`/api/reports/${reportId}/download`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });
});
