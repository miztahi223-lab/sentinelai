import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPageLayout } from "@/components/LegalPageLayout";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo";

// Kept deliberately factual about the product and its scope — no invented
// founding story, team bios, or company history, since none of those are
// real for this build.
const CONTENT: Record<
  Locale,
  { title: string; subtitle: string; sections: { heading: string; body: string }[] }
> = {
  en: {
    title: "About SentinelAI",
    subtitle: "Attack-surface monitoring built for businesses that don't have a security team.",
    sections: [
      {
        heading: "The problem",
        body: "Most small and medium-sized businesses accumulate an online footprint faster than anyone tracks it — a forgotten staging subdomain, an expiring certificate, a misconfigured header. A large security vendor will sell you a dashboard built for an enterprise security team. Most SMBs don't have one.",
      },
      {
        heading: "What SentinelAI does",
        body: "Point it at your domains and it continuously discovers what's actually reachable about your organization from the outside — DNS records, subdomains, TLS certificates, exposed services — scores your security posture on a transparent 0-100 scale, and explains every finding in plain language instead of technical jargon, with a specific recommended fix.",
      },
      {
        heading: "Who it's for",
        body: "Business owners and small teams who need to know what's exposed and what to do about it, without needing to hire a security specialist to interpret the results first.",
      },
      {
        heading: "Get in touch",
        body: "Questions, feedback, or just want to say hello? Reach out through the contact page — a real person reads every message.",
      },
    ],
  },
  he: {
    title: "אודות SentinelAI",
    subtitle: "ניטור נוכחות מקוונת שנבנה עבור עסקים שאין להם צוות אבטחה.",
    sections: [
      {
        heading: "הבעיה",
        body: "רוב העסקים הקטנים והבינוניים צוברים נוכחות מקוונת מהר יותר מכפי שמישהו עוקב אחריה — תת-דומיין נטוש בסביבת בדיקות, אישור שעומד לפוג, כותרת שהוגדרה לא נכון. ספק אבטחה גדול ימכור לכם לוח בקרה שנבנה עבור צוות אבטחה ארגוני. לרוב העסקים הקטנים והבינוניים אין כזה.",
      },
      {
        heading: "מה SentinelAI עושה",
        body: "כוונו אותו לדומיינים שלכם והוא מגלה ברציפות מה באמת נגיש לגבי הארגון שלכם מבחוץ — רשומות DNS, תת-דומיינים, אישורי TLS, שירותים חשופים — מדרג את רמת האבטחה שלכם בסולם שקוף של 0-100, ומסביר כל ממצא בשפה פשוטה במקום ז'רגון טכני, עם תיקון מומלץ וספציפי.",
      },
      {
        heading: "למי זה מיועד",
        body: "בעלי עסקים וצוותים קטנים שצריכים לדעת מה חשוף ומה לעשות בקשר לזה, בלי צורך לשכור מומחה אבטחה כדי לפרש את התוצאות קודם.",
      },
      {
        heading: "צרו קשר",
        body: "שאלות, משוב, או סתם רוצים להגיד שלום? צרו קשר דרך עמוד יצירת הקשר — אדם אמיתי קורא כל הודעה.",
      },
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    path: "/about",
    // `title` is already "About SentinelAI" — no need to append the brand
    // name again like the other pages do.
    title: CONTENT[locale].title,
    description: CONTENT[locale].subtitle,
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { title, subtitle, sections } = CONTENT[locale];

  return <LegalPageLayout title={title} subtitle={subtitle} sections={sections} />;
}
