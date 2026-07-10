"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { OrganizationProvider } from "@/lib/organization-context";
import { Sidebar } from "@/components/Sidebar";
import { MatrixRain } from "@/components/MatrixRain";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("sidebar");
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        {t("loading")}
      </div>
    );
  }

  return (
    <OrganizationProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        {/* A deliberately much fainter version of the marketing site's
            matrix-rain accent (0.05 vs 0.12-0.14) — this is a working data
            tool people use daily, not a landing page, so the bar here is
            "ties the visual identity together as ambient texture" rather
            than "make a visual statement." Fixed (not absolute) so it
            doesn't scroll away/repeat awkwardly as the real content
            scrolls past it. */}
        <main className="relative flex-1 overflow-y-auto bg-gray-950 px-8 py-8">
          {/* Wrapped in its own `fixed inset-0` container rather than
              trying to override MatrixRain's own `absolute` positioning
              via an appended class — two Tailwind classes setting the
              same CSS property don't reliably resolve by className string
              order (only by their order in the generated stylesheet), so
              this wrapper is the safe way to make it viewport-fixed. */}
          <div className="pointer-events-none fixed inset-0 opacity-[0.05]">
            <MatrixRain />
          </div>
          <div className="relative">{children}</div>
        </main>
      </div>
    </OrganizationProvider>
  );
}
