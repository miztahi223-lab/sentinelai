"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Deliberately outside `[locale]/layout.tsx` (Next.js requires this at the
// true app root): this only renders when the root layout itself throws, so
// no locale/theme provider can be trusted to still be working — a plain,
// hardcoded fallback matching the site's dark theme, not the full app chrome.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-100">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-gray-400">
            The error has been reported. Please try refreshing the page.
          </p>
        </div>
      </body>
    </html>
  );
}
