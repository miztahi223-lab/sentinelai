import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { AmbientBackground } from "@/components/AmbientBackground";

export interface StaticPageSection {
  heading: string;
  body: string;
}

interface LegalPageLayoutProps {
  title: string;
  subtitle?: string;
  sections: StaticPageSection[];
  children?: React.ReactNode;
}

/**
 * Shared shell for the marketing site's static content pages (terms,
 * privacy, security, roadmap, about) — extracted once terms/privacy/
 * security/roadmap/about all needed the exact same "title + subtitle +
 * a list of heading/body sections" structure, rather than copy-pasting the
 * same ~30 lines a fifth time.
 */
export function LegalPageLayout({
  title,
  subtitle,
  sections,
  children,
}: LegalPageLayoutProps) {
  return (
    <>
      <MarketingNav />
      <main id="main-content" className="flex-1">
        {/* Ambient background scoped to just the title/subtitle, not the
            body text below — continuous motion behind dense reading would
            hurt exactly the readability these pages most need. */}
        <div className="relative overflow-hidden">
          <AmbientBackground />
          <div className="relative mx-auto max-w-3xl px-6 pt-20 pb-4">
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-gray-400">{subtitle}</p>}
          </div>
        </div>
        <section className="mx-auto max-w-3xl px-6 pb-20">
          <div className="mt-6 space-y-8">
            {sections.map((section) => (
              <div key={section.heading}>
                <h2 className="text-base font-medium text-white">{section.heading}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{section.body}</p>
              </div>
            ))}
          </div>
          {children}
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
