import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import * as Sentry from '@sentry/nestjs';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import request from 'supertest';
import { App } from 'supertest/types';

@Controller('sentry-test')
class ThrowingController {
  @Get('boom')
  boom(): never {
    throw new Error('deliberate test error for Sentry wiring');
  }
}

@Module({
  controllers: [ThrowingController],
  providers: [{ provide: APP_FILTER, useClass: SentryGlobalFilter }],
})
class ThrowingTestModule {}

/**
 * A genuine end-to-end check of the SentryGlobalFilter wiring (Enhancement:
 * error tracking/monitoring): a real unhandled exception is thrown through a
 * real Nest HTTP pipeline with the exact filter registered in
 * `app.module.ts`. Rather than spying on `@sentry/core`'s frozen exports
 * (Jest can't redefine them), this initializes a real Sentry client with a
 * fake DSN and a custom transport, then asserts the exception actually made
 * it all the way through the real capture pipeline into an outgoing
 * envelope, and that the client still gets the same 500 response shape
 * Nest's default handler would have produced.
 *
 * `defaultIntegrations: false` / `integrations: []` deliberately skips
 * Sentry's OpenTelemetry auto-instrumentation (which globally monkey-patches
 * `http.Server`): installing that here, inside a shared Jest worker, was
 * observed to hang unrelated e2e suites' `app.close()` in `afterAll` (every
 * other suite sharing the same worker timed out). A bare client is all
 * `SentryGlobalFilter` needs, since it only ever calls `captureException`
 * directly.
 */
describe('Sentry error capture (e2e)', () => {
  let app: INestApplication<App>;
  const sentEnvelopes: unknown[] = [];

  beforeAll(async () => {
    Sentry.init({
      dsn: 'https://public@o0.ingest.sentry.io/0',
      enabled: true,
      defaultIntegrations: false,
      integrations: [],
      transport: () => ({
        send: (envelope) => {
          sentEnvelopes.push(envelope);
          return Promise.resolve({});
        },
        flush: () => Promise.resolve(true),
      }),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ThrowingTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports an unhandled exception to Sentry and still returns a normal 500', async () => {
    const res = await request(app.getHttpServer())
      .get('/sentry-test/boom')
      .expect(500);

    expect(res.body.statusCode).toBe(500);

    await Sentry.flush(2000);
    expect(sentEnvelopes.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(sentEnvelopes);
    expect(serialized).toContain('deliberate test error for Sentry wiring');
  });
});
