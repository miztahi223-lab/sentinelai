import { setRequestLocale } from "next-intl/server";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import type { Locale } from "@/i18n/routing";

const LAST_UPDATED = "July 2026";

const CONTENT: Record<Locale, { title: string; sections: { heading: string; body: string }[] }> = {
  en: {
    title: "Terms of Service",
    sections: [
      {
        heading: "1. Acceptance of these terms",
        body: "By creating an account or using SentinelAI (the \"Service\"), you agree to these Terms of Service. If you're using the Service on behalf of an organization, you're agreeing on that organization's behalf and confirming you have the authority to do so.",
      },
      {
        heading: "2. What the Service does",
        body: "SentinelAI performs read-only, non-intrusive discovery and monitoring of publicly reachable information about domains you add — DNS records, subdomains, TLS certificates, and HTTP responses — and produces a security score, findings, alerts, and reports based on that information.",
      },
      {
        heading: "3. Authorized use only — this is the most important section",
        body: "You may only add and scan domains that you own, or that you have clear, documented authorization to monitor. SentinelAI is a defensive reconnaissance tool, not a penetration-testing or exploitation tool, but running any kind of scan against infrastructure you don't control or have permission to test can violate the law and other parties' terms of service. You are solely responsible for confirming you have the right to monitor any domain you add, and for any consequences of failing to do so.",
      },
      {
        heading: "4. Accounts",
        body: "You're responsible for keeping your account credentials confidential and for all activity under your account. Tell us immediately if you suspect unauthorized access.",
      },
      {
        heading: "5. Subscriptions and billing",
        body: "Paid plans are billed in advance on a recurring basis through our payment processor (Stripe). You can upgrade, downgrade, or cancel at any time from your billing settings; changes take effect according to the billing cycle in progress at the time.",
      },
      {
        heading: "6. Acceptable use",
        body: "Don't use the Service to store or process illegal content, to attempt to disrupt or gain unauthorized access to the Service itself, or to monitor domains without proper authorization (see Section 3).",
      },
      {
        heading: "7. Disclaimer and limitation of liability",
        body: "The Service is provided \"as is.\" Security scoring and findings are informational and best-effort — they are not a guarantee that a domain is secure, nor a substitute for a professional security assessment. To the maximum extent permitted by law, SentinelAI is not liable for indirect, incidental, or consequential damages arising from use of the Service.",
      },
      {
        heading: "8. Changes to these terms",
        body: "We may update these terms from time to time. Continued use of the Service after a change means you accept the updated terms.",
      },
      {
        heading: "9. Contact",
        body: "Questions about these terms? Reach out via the contact page.",
      },
    ],
  },
  he: {
    title: "תנאי שימוש",
    sections: [
      {
        heading: "1. הסכמה לתנאים אלה",
        body: "על ידי יצירת חשבון או שימוש ב-SentinelAI (\"השירות\"), אתם מסכימים לתנאי שימוש אלה. אם אתם משתמשים בשירות מטעם ארגון, אתם מסכימים בשם אותו ארגון ומאשרים שיש לכם את הסמכות לעשות זאת.",
      },
      {
        heading: "2. מה השירות עושה",
        body: "SentinelAI מבצע גילוי וניטור לקריאה בלבד ולא פולשני של מידע נגיש באופן ציבורי על דומיינים שאתם מוסיפים — רשומות DNS, תת-דומיינים, אישורי TLS ותגובות HTTP — ומפיק ציון אבטחה, ממצאים, התראות ודוחות על סמך מידע זה.",
      },
      {
        heading: "3. שימוש מורשה בלבד — זה הסעיף החשוב ביותר",
        body: "אתם רשאים להוסיף ולסרוק רק דומיינים שבבעלותכם, או שיש לכם הרשאה ברורה ומתועדת לנטר אותם. SentinelAI הוא כלי סיור מודיעיני הגנתי, לא כלי לבדיקות חדירה או ניצול, אבל הרצת כל סוג של סריקה נגד תשתית שאינה בשליטתכם או שאין לכם הרשאה לבדוק עלולה להפר את החוק ואת תנאי השימוש של צדדים אחרים. האחריות המלאה לוודא שיש לכם את הזכות לנטר כל דומיין שאתם מוסיפים, ולכל תוצאה של אי-עמידה בכך, מוטלת עליכם בלבד.",
      },
      {
        heading: "4. חשבונות",
        body: "אתם אחראים לשמור על סודיות פרטי הגישה לחשבון שלכם ועל כל פעילות המתבצעת תחת החשבון שלכם. עדכנו אותנו מיידית אם אתם חושדים בגישה לא מורשית.",
      },
      {
        heading: "5. מנויים וחיוב",
        body: "תוכניות בתשלום מחויבות מראש על בסיס חוזר דרך מעבד התשלומים שלנו (Stripe). תוכלו לשדרג, להוריד דרגה, או לבטל בכל עת מהגדרות החיוב שלכם; שינויים ייכנסו לתוקף בהתאם למחזור החיוב הפעיל באותו זמן.",
      },
      {
        heading: "6. שימוש מותר",
        body: "אין להשתמש בשירות לאחסון או עיבוד תוכן בלתי חוקי, לניסיון לשבש או לקבל גישה לא מורשית לשירות עצמו, או לניטור דומיינים ללא הרשאה מתאימה (ראו סעיף 3).",
      },
      {
        heading: "7. כתב ויתור והגבלת אחריות",
        body: "השירות ניתן \"כפי שהוא\" (as is). דירוג האבטחה והממצאים הם אינפורמטיביים ומבוססי מאמץ סביר — הם אינם מהווים ערובה לכך שדומיין מאובטח, ואינם תחליף להערכת אבטחה מקצועית. במידה המרבית המותרת על פי חוק, SentinelAI אינו אחראי לנזקים עקיפים, אגביים או תוצאתיים הנובעים משימוש בשירות.",
      },
      {
        heading: "8. שינויים בתנאים אלה",
        body: "אנו עשויים לעדכן תנאים אלה מעת לעת. המשך שימוש בשירות לאחר שינוי משמעו הסכמה לתנאים המעודכנים.",
      },
      {
        heading: "9. יצירת קשר",
        body: "שאלות לגבי תנאים אלה? צרו קשר דרך עמוד יצירת הקשר.",
      },
    ],
  },
};

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { title, sections } = CONTENT[locale];

  return (
    <>
      <MarketingNav />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 py-20">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {locale === "he" ? `עודכן לאחרונה: ${LAST_UPDATED}` : `Last updated: ${LAST_UPDATED}`}
          </p>
          <div className="mt-10 space-y-8">
            {sections.map((section) => (
              <div key={section.heading}>
                <h2 className="text-base font-medium text-white">{section.heading}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{section.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
