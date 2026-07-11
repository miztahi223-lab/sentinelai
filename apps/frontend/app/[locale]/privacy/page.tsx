import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPageLayout } from "@/components/LegalPageLayout";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo";

const LAST_UPDATED = "July 2026";

const META_DESCRIPTION: Record<Locale, string> = {
  en: "How SentinelAI collects, uses, and protects your data.",
  he: "כיצד SentinelAI אוסף, משתמש ומגן על הנתונים שלכם.",
};

const CONTENT: Record<Locale, { title: string; sections: { heading: string; body: string }[] }> = {
  en: {
    title: "Privacy Policy",
    sections: [
      {
        heading: "What we collect",
        body: "Account information you provide directly: your name, email address, organization name, and password (stored only as a salted Argon2id hash — we never store or can retrieve your actual password). Domains you add for monitoring, and the discovery results for them (DNS records, subdomains, TLS certificate details, HTTP response headers, and detected technologies — all information that's already publicly reachable, not anything private about you or your infrastructure). If you contact us or submit the contact form, we keep what you send us so we can reply.",
      },
      {
        heading: "What we don't collect",
        body: "We don't scan or store the contents of anything behind authentication on your domains, don't attempt to access non-public systems, and don't sell or share your account or domain data with third parties for marketing purposes.",
      },
      {
        heading: "How we use it",
        body: "To provide the Service (running scans, computing your security score, sending alert emails, generating reports), to bill you if you're on a paid plan, and to respond if you contact us. Findings may optionally be sent to our AI provider (Anthropic) to generate a plain-language explanation — only when you explicitly request an AI analysis for a specific finding, and only the finding's own data (title, description, severity, category) is sent, never your full account or credentials.",
      },
      {
        heading: "Third-party services we use",
        body: "Stripe processes payments for paid plans — we never see or store your card details ourselves. Our email provider sends verification, password-reset, and alert emails. Anthropic's API powers optional AI-generated finding explanations, only when you request them.",
      },
      {
        heading: "Data retention",
        body: "Your account and domain data is kept for as long as your account is active. You can request deletion of your account and associated data at any time by contacting us.",
      },
      {
        heading: "Your rights",
        body: "You can access, correct, or request deletion of your personal data at any time. Contact us via the contact page to make a request.",
      },
      {
        heading: "Security",
        body: "Passwords are hashed with Argon2id, sessions use short-lived access tokens with rotating single-use refresh tokens, and all administrative access to production systems is restricted. No system is perfectly secure, but this is built with real security practices, not just a checkbox.",
      },
      {
        heading: "Changes to this policy",
        body: "We may update this policy from time to time; continued use of the Service after a change means you accept the updated policy.",
      },
      {
        heading: "Contact",
        body: "Questions about this policy or your data? Reach out via the contact page.",
      },
    ],
  },
  he: {
    title: "מדיניות פרטיות",
    sections: [
      {
        heading: "מה אנחנו אוספים",
        body: "מידע חשבון שאתם מספקים ישירות: שם, כתובת אימייל, שם הארגון, וסיסמה (נשמרת רק כ-hash מסוג Argon2id עם salt — אנחנו לעולם לא שומרים או יכולים לשחזר את הסיסמה בפועל שלכם). דומיינים שאתם מוסיפים לניטור, ותוצאות הגילוי עבורם (רשומות DNS, תת-דומיינים, פרטי אישור TLS, כותרות תגובת HTTP וטכנולוגיות מזוהות — כל המידע הזה כבר נגיש באופן ציבורי, לא משהו פרטי עליכם או על התשתית שלכם). אם אתם יוצרים איתנו קשר או שולחים את טופס יצירת הקשר, אנחנו שומרים את מה ששלחתם כדי שנוכל להשיב.",
      },
      {
        heading: "מה אנחנו לא אוספים",
        body: "אנחנו לא סורקים או שומרים תוכן שנמצא מאחורי אימות בדומיינים שלכם, לא מנסים לגשת למערכות שאינן ציבוריות, ולא מוכרים או משתפים את נתוני החשבון או הדומיין שלכם עם צדדים שלישיים למטרות שיווק.",
      },
      {
        heading: "איך אנחנו משתמשים בזה",
        body: "כדי לספק את השירות (הרצת סריקות, חישוב ציון האבטחה שלכם, שליחת מיילי התראה, הפקת דוחות), לחייב אתכם אם אתם בתוכנית בתשלום, ולהשיב אם אתם יוצרים איתנו קשר. ממצאים עשויים להישלח באופן אופציונלי לספק הבינה המלאכותית שלנו (Anthropic) כדי להפיק הסבר בשפה פשוטה — רק כאשר אתם מבקשים במפורש ניתוח בינה מלאכותית עבור ממצא ספציפי, ורק המידע של הממצא עצמו (כותרת, תיאור, חומרה, קטגוריה) נשלח, לעולם לא החשבון המלא או פרטי הגישה שלכם.",
      },
      {
        heading: "שירותי צד שלישי בהם אנו משתמשים",
        body: "Stripe מעבד תשלומים עבור תוכניות בתשלום — אנחנו לעולם לא רואים או שומרים את פרטי הכרטיס שלכם בעצמנו. ספק האימייל שלנו שולח מיילי אימות, איפוס סיסמה והתראות. ה-API של Anthropic מפעיל הסברי ממצאים אופציונליים מבוססי בינה מלאכותית, רק כאשר אתם מבקשים זאת.",
      },
      {
        heading: "שמירת מידע",
        body: "נתוני החשבון והדומיין שלכם נשמרים כל עוד החשבון שלכם פעיל. תוכלו לבקש מחיקה של החשבון שלכם והנתונים המשויכים אליו בכל עת על ידי יצירת קשר איתנו.",
      },
      {
        heading: "הזכויות שלכם",
        body: "תוכלו לגשת, לתקן, או לבקש מחיקה של המידע האישי שלכם בכל עת. צרו קשר דרך עמוד יצירת הקשר כדי להגיש בקשה.",
      },
      {
        heading: "אבטחה",
        body: "סיסמאות מוצפנות עם Argon2id, הפעלות (sessions) משתמשות ב-access tokens קצרי מועד עם refresh tokens חד-פעמיים ומתחלפים, וכל גישה ניהולית למערכות הפרודקשן מוגבלת. אין מערכת מאובטחת לחלוטין, אבל זה נבנה עם שיטות אבטחה אמיתיות, לא רק כסימון וי בטופס.",
      },
      {
        heading: "שינויים במדיניות זו",
        body: "אנו עשויים לעדכן מדיניות זו מעת לעת; המשך שימוש בשירות לאחר שינוי משמעו הסכמה למדיניות המעודכנת.",
      },
      {
        heading: "יצירת קשר",
        body: "שאלות לגבי מדיניות זו או הנתונים שלכם? צרו קשר דרך עמוד יצירת הקשר.",
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
    path: "/privacy",
    title: `${CONTENT[locale].title} — SentinelAI`,
    description: META_DESCRIPTION[locale],
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { title, sections } = CONTENT[locale];
  const subtitle =
    locale === "he" ? `עודכן לאחרונה: ${LAST_UPDATED}` : `Last updated: ${LAST_UPDATED}`;

  return <LegalPageLayout title={title} subtitle={subtitle} sections={sections} />;
}
