import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPageLayout } from "@/components/LegalPageLayout";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo";

// Every claim below describes something actually implemented in this
// codebase (checked against the real source, not aspirational) —
// consistent with this build's standing rule to never describe a feature
// as done unless it's real: Argon2id (auth/token/password services),
// rotating opaque refresh tokens (auth/token.service.ts), the SSRF guard
// (discovery/ssrf-guard.ts, including the literal-IP fix), read-only
// discovery (no exploit/write code path anywhere in discovery/), rate
// limiting (ThrottlerModule in app.module.ts), and the security headers
// this very site's own responses already carry (helmet-equivalent CSP/
// HSTS/etc., visible on every real API response).
const CONTENT: Record<
  Locale,
  { title: string; subtitle: string; sections: { heading: string; body: string }[] }
> = {
  en: {
    title: "Security",
    subtitle: "How DomeCortex AI itself is built — not just what it checks for you.",
    sections: [
      {
        heading: "Read-only reconnaissance, always",
        body: "The scanning engine only ever reads what's already publicly reachable — DNS records, TLS certificates, HTTP responses. It never attempts to exploit, modify, authenticate against, or write to anything it discovers. This isn't a policy promise layered on top; it's a structural property of the codebase — there is no code path anywhere in the discovery engine that does anything but read.",
      },
      {
        heading: "Guarded against misusing our own infrastructure",
        body: "Before connecting to any host, every outbound scan and webhook delivery is checked against private, loopback, link-local, and cloud-metadata address ranges (the same class of address a Server-Side Request Forgery attack targets) — including literal IP addresses, not only hostnames that resolve to one. A domain or webhook URL that points at internal infrastructure is refused before any connection is attempted.",
      },
      {
        heading: "Passwords and sessions",
        body: "Passwords are hashed with Argon2id (the current OWASP-recommended algorithm) — we never store, and cannot retrieve, your actual password. Sessions use short-lived JWT access tokens plus rotating, single-use refresh tokens: redeeming a refresh token immediately revokes it and issues a new one, so a stolen-and-reused token is detectable rather than silently valid indefinitely.",
      },
      {
        heading: "Rate limiting and transport security",
        body: "Every API endpoint is rate-limited per IP address. Real HTTPS in production, HSTS, a strict Content-Security-Policy, and standard hardening headers (X-Content-Type-Options, X-Frame-Options, and others) are applied to every response.",
      },
      {
        heading: "Your data stays yours",
        body: "Every score and finding links back to the exact real signal that produced it — no black-box numbers. You can export or delete your data at any time; see the Privacy Policy for the full detail on what's collected and why.",
      },
      {
        heading: "Found a security issue?",
        body: "If you believe you've found a security vulnerability in DomeCortex AI itself, please tell us through the contact page rather than a public issue or social media — we read and respond to every message sent that way.",
      },
    ],
  },
  he: {
    title: "אבטחה",
    subtitle: "איך DomeCortex AI עצמו בנוי — לא רק מה הוא בודק עבורכם.",
    sections: [
      {
        heading: "סיור מודיעיני לקריאה בלבד, תמיד",
        body: "מנוע הסריקה קורא רק מה שכבר נגיש באופן ציבורי — רשומות DNS, אישורי TLS, תגובות HTTP. הוא לעולם לא מנסה לנצל, לשנות, להתחבר, או לכתוב לשום דבר שהוא מגלה. זו לא רק הבטחה מדיניות שהוספנו — זו תכונה מבנית של הקוד עצמו: אין שום נתיב קוד במנוע הגילוי שעושה משהו מלבד קריאה.",
      },
      {
        heading: "מוגנים מפני שימוש לרעה בתשתית שלנו עצמנו",
        body: "לפני התחברות לכל מארח, כל סריקה יוצאת ומשלוח webhook נבדקים מול טווחי כתובות פרטיים, לוקאליים, link-local, ומטא-נתוני ענן (אותו סוג כתובת שמתקפת SSRF מכוונת אליו) — כולל כתובות IP ליטרליות, לא רק שמות מארח שמתפענחים לכאלה. דומיין או כתובת webhook שמצביעים על תשתית פנימית נדחים לפני שמתבצע כל חיבור.",
      },
      {
        heading: "סיסמאות והפעלות",
        body: "סיסמאות מוצפנות (hash) עם Argon2id (האלגוריתם המומלץ כיום על ידי OWASP) — אנחנו לעולם לא שומרים, ולא יכולים לשחזר, את הסיסמה האמיתית שלכם. הפעלות (sessions) משתמשות בטוקני JWT קצרי-טווח יחד עם טוקני רענון מסתובבים וחד-פעמיים: מימוש טוקן רענון מבטל אותו מיידית ומנפיק חדש, כך שטוקן גנוב שנעשה בו שימוש חוזר ניתן לזיהוי במקום להיות תקף בשקט לצמיתות.",
      },
      {
        heading: "הגבלת קצב ואבטחת תעבורה",
        body: "כל נקודת קצה ב-API מוגבלת בקצב לפי כתובת IP. HTTPS אמיתי בסביבת ייצור, HSTS, מדיניות אבטחת תוכן (CSP) קפדנית, וכותרות הקשחה סטנדרטיות (X-Content-Type-Options, X-Frame-Options ואחרות) מוחלות על כל תגובה.",
      },
      {
        heading: "הנתונים שלכם נשארים שלכם",
        body: "כל ציון וממצא מקושרים בחזרה לאות האמיתי המדויק שיצר אותם — בלי מספרים של 'קופסה שחורה'. תוכלו לייצא או למחוק את הנתונים שלכם בכל עת; ראו את מדיניות הפרטיות לפרטים המלאים על מה נאסף ולמה.",
      },
      {
        heading: "מצאתם בעיית אבטחה?",
        body: "אם אתם סבורים שמצאתם פגיעות אבטחה ב-DomeCortex AI עצמו, אנא ספרו לנו דרך עמוד יצירת הקשר ולא דרך issue ציבורי או רשת חברתית — אנחנו קוראים ומגיבים לכל הודעה שנשלחת בדרך הזו.",
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
    path: "/security",
    title: `${CONTENT[locale].title} — DomeCortex AI`,
    description: CONTENT[locale].subtitle,
  });
}

export default async function SecurityPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { title, subtitle, sections } = CONTENT[locale];

  return <LegalPageLayout title={title} subtitle={subtitle} sections={sections} />;
}
