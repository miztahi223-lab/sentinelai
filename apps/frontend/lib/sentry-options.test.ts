import { describe, expect, it } from "vitest";
import { resolveSentryOptions } from "./sentry-options";

describe("resolveSentryOptions", () => {
  it("is disabled when NEXT_PUBLIC_SENTRY_DSN is unset", () => {
    const options = resolveSentryOptions({} as NodeJS.ProcessEnv);
    expect(options.enabled).toBe(false);
    expect(options.dsn).toBeUndefined();
    expect(options.tracesSampleRate).toBe(0);
  });

  it("is enabled once a real NEXT_PUBLIC_SENTRY_DSN is configured", () => {
    const options = resolveSentryOptions({
      NEXT_PUBLIC_SENTRY_DSN: "https://public@o0.ingest.sentry.io/0",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);
    expect(options.enabled).toBe(true);
    expect(options.dsn).toBe("https://public@o0.ingest.sentry.io/0");
    expect(options.environment).toBe("production");
    expect(options.tracesSampleRate).toBeGreaterThan(0);
  });

  it("defaults environment to development when NODE_ENV is unset", () => {
    const options = resolveSentryOptions({} as NodeJS.ProcessEnv);
    expect(options.environment).toBe("development");
  });
});
