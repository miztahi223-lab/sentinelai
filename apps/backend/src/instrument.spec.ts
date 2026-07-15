import { resolveSentryOptions } from './instrument';

describe('resolveSentryOptions', () => {
  it('is disabled when SENTRY_DSN is unset', () => {
    const options = resolveSentryOptions({});
    expect(options.enabled).toBe(false);
    expect(options.dsn).toBeUndefined();
    expect(options.tracesSampleRate).toBe(0);
  });

  it('is enabled once a real SENTRY_DSN is configured', () => {
    const options = resolveSentryOptions({
      SENTRY_DSN: 'https://public@o0.ingest.sentry.io/0',
      NODE_ENV: 'production',
    });
    expect(options.enabled).toBe(true);
    expect(options.dsn).toBe('https://public@o0.ingest.sentry.io/0');
    expect(options.environment).toBe('production');
    expect(options.tracesSampleRate).toBeGreaterThan(0);
  });

  it('defaults environment to development when NODE_ENV is unset', () => {
    const options = resolveSentryOptions({});
    expect(options.environment).toBe('development');
  });
});
