import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPageLayout } from "@/components/LegalPageLayout";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo";

const LAST_UPDATED = "July 2026";

// Every claim below describes something actually implemented in this
// codebase (checked against the real source) — same standing rule as
// every other trust page. This deliberately does NOT claim full
// certified compliance with Israeli Standard 5568 (a real, specific legal
// designation this build has not been professionally audited against) —
// it states what's actually been built and reviewed, and that formal
// certification is in progress, which is the honest state of things.
const CONTENT: Record<
  Locale,
  { title: string; subtitle: string; sections: { heading: string; body: string }[] }
> = {
  en: {
    title: "Accessibility",
    subtitle: "Our commitment to an accessible product, and where things actually stand today.",
    sections: [
      {
        heading: "Our commitment",
        body: "DomeCortex AI is being built to conform to WCAG 2.0 Level AA and Israeli Standard 5568, in line with the Equal Rights for Persons with Disabilities Regulations (Accessibility of Services). This is an ongoing effort, not a one-time checkbox — accessibility is reviewed as part of building every new feature, not bolted on afterward.",
      },
      {
        heading: "What's implemented today",
        body: "Full keyboard navigation, a \"skip to main content\" link on every page, visible focus indicators on every interactive element, real semantic HTML landmarks (header/nav/main/footer, not generic divs), alternative text on every image, labeled form fields (not placeholder-only labels), and text/background color combinations that meet the required contrast ratios.",
      },
      {
        heading: "What this doesn't cover yet",
        body: "This statement reflects genuine engineering work, not a certified third-party audit — we have not yet engaged an accredited accessibility auditor to formally certify conformance with Israeli Standard 5568. If a professional audit finds specific gaps, we will list and fix them here.",
      },
      {
        heading: "Ran into a problem?",
        body: "If you encounter any accessibility barrier using DomeCortex AI — with a screen reader, keyboard-only navigation, or anything else — please tell us through the contact page. A real person reads every message, and accessibility reports are treated as priority bug reports, not general feedback.",
      },
      {
        heading: "Last reviewed",
        body: `This statement was last reviewed in ${LAST_UPDATED}.`,
      },
    ],
  },
  he: {
    title: "נגישות",
    subtitle: "המחויבות שלנו למוצר נגיש, והמצב האמיתי של הדברים היום.",
    sections: [
      {
        heading: "המחויבות שלנו",
        body: "DomeCortex AI נבנה כדי לעמוד בתקן WCAG 2.0 רמה AA ובתקן הישראלי 5568, בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (נגישות השירות). זהו מאמץ מתמשך ולא סעיף חד-פעמי — נגישות נבדקת כחלק מבניית כל תכונה חדשה, לא מתווספת בדיעבד.",
      },
      {
        heading: "מה מיושם היום",
        body: "ניווט מלא במקלדת, קישור \"דלג לתוכן הראשי\" בכל עמוד, אינדיקציית פוקוס גלויה על כל רכיב אינטראקטיבי, תגיות HTML סמנטיות אמיתיות (header/nav/main/footer, לא divים גנריים), טקסט חלופי לכל תמונה, שדות טופס עם תוויות אמיתיות (לא placeholder בלבד), וצירופי צבעי טקסט/רקע העומדים ביחסי הניגודיות הנדרשים.",
      },
      {
        heading: "מה זה עדיין לא מכסה",
        body: "הצהרה זו משקפת עבודת הנדסה אמיתית, לא ביקורת מוסמכת של גורם שלישי — טרם פנינו לבודק נגישות מוסמך לצורך הסמכה רשמית לעמידה בתקן הישראלי 5568. אם ביקורת מקצועית תמצא פערים ספציפיים, נפרט ונתקן אותם כאן.",
      },
      {
        heading: "נתקלתם בבעיה?",
        body: "אם נתקלתם במכשול נגישות כלשהו בשימוש ב-DomeCortex AI — עם קורא מסך, ניווט במקלדת בלבד, או כל דבר אחר — אנא ספרו לנו דרך עמוד יצירת הקשר. אדם אמיתי קורא כל הודעה, ודיווחי נגישות מטופלים כדיווחי באג בעדיפות גבוהה, לא כמשוב כללי.",
      },
      {
        heading: "עודכן לאחרונה",
        body: `הצהרה זו נבדקה לאחרונה ב-${LAST_UPDATED}.`,
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
    path: "/accessibility",
    title: `${CONTENT[locale].title} — DomeCortex AI`,
    description: CONTENT[locale].subtitle,
  });
}

export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { title, subtitle, sections } = CONTENT[locale];

  return <LegalPageLayout title={title} subtitle={subtitle} sections={sections} />;
}
