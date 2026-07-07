import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Produces a minimal, self-contained `.next/standalone` server bundle
  // (only the production node_modules a request actually needs, traced via
  // webpack) — this is what makes the production Docker image small and
  // avoids copying the entire node_modules tree into the final image.
  output: "standalone",
};

export default withNextIntl(nextConfig);
