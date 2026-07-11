import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPageLayout } from "@/components/LegalPageLayout";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo";

// Every item below is a real, currently-true gap in this codebase (checked
// against the actual source, not invented) — no delivery dates are
// promised, since none are real yet. Matches this build's standing rule:
// an honest "not built yet" is fine, a fabricated commitment is not.
const CONTENT: Record<
  Locale,
  { title: string; subtitle: string; sections: { heading: string; body: string }[] }
> = {
  en: {
    title: "Roadmap",
    subtitle: "What's real today, and what we're building next — no invented delivery dates.",
    sections: [
      {
        heading: "Plan-based scan frequency",
        body: "Every tracked domain is currently re-scanned on the same daily schedule regardless of plan, even though the Free plan is described as weekly and Business as real-time. Making the actual scan cadence match each plan is next.",
      },
      {
        heading: "Historical trend charts in PDF reports",
        body: "The dashboard already shows a real score-over-time chart. Reports currently cover a single scan snapshot — bringing that same historical view into the PDF is planned.",
      },
      {
        heading: "Custom report branding",
        body: "Reports carry SentinelAI's own branding today. Letting an organization add its own logo to reports it generates is planned, for teams that share these with their own clients or leadership.",
      },
      {
        heading: "Two-factor authentication",
        body: "Account login currently supports email + password only. Optional two-factor authentication is planned.",
      },
      {
        heading: "Public API access",
        body: "There's no documented, stable public API yet for pulling your own domains/findings/scores into another tool. This is on our radar once the current feature set has settled.",
      },
    ],
  },
  he: {
    title: "מפת דרכים",
    subtitle: "מה אמיתי היום, ומה אנחנו בונים הבא — בלי תאריכי אספקה מומצאים.",
    sections: [
      {
        heading: "תדירות סריקה מבוססת תוכנית",
        body: "כרגע כל דומיין במעקב נסרק מחדש לפי אותו לוח זמנים יומי ללא קשר לתוכנית, למרות שהתוכנית החינמית מתוארת כשבועית והעסקית כזמן אמת. התאמת קצב הסריקה בפועל לכל תוכנית היא הצעד הבא.",
      },
      {
        heading: "גרפי מגמה היסטוריים בדוחות PDF",
        body: "לוח הבקרה כבר מציג גרף אמיתי של ציון לאורך זמן. דוחות כרגע מכסים תמונת מצב של סריקה בודדת — הבאת אותה תצוגה היסטורית גם ל-PDF מתוכננת.",
      },
      {
        heading: "מיתוג מותאם אישית לדוחות",
        body: "דוחות נושאים כיום את המיתוג של SentinelAI עצמו. אפשרות לארגון להוסיף את הלוגו שלו לדוחות שהוא מייצר מתוכננת, עבור צוותים שמשתפים אותם עם הלקוחות או ההנהלה שלהם.",
      },
      {
        heading: "אימות דו-שלבי",
        body: "כניסה לחשבון תומכת כרגע רק באימייל וסיסמה. אימות דו-שלבי אופציונלי מתוכנן.",
      },
      {
        heading: "גישת API ציבורי",
        body: "עדיין אין API ציבורי מתועד ויציב למשיכת הדומיינים/הממצאים/הציונים שלכם לכלי אחר. זה נמצא על הרדאר שלנו לאחר שמערכת התכונות הנוכחית תתייצב.",
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
    path: "/roadmap",
    title: `${CONTENT[locale].title} — SentinelAI`,
    description: CONTENT[locale].subtitle,
  });
}

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { title, subtitle, sections } = CONTENT[locale];

  return <LegalPageLayout title={title} subtitle={subtitle} sections={sections} />;
}
