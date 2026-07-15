import * as Sentry from "@sentry/nextjs";
import { resolveSentryOptions } from "./lib/sentry-options";

Sentry.init(resolveSentryOptions());
