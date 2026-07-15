import * as Sentry from "@sentry/nextjs";
import { resolveSentryOptions } from "./lib/sentry-options";

// Runs for the edge runtime (proxy.ts / middleware).
Sentry.init(resolveSentryOptions());
