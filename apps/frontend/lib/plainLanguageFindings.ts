/**
 * A pure display transform — takes the real, technical finding
 * title/description the risk engine actually generated (see
 * `apps/backend/src/risk-engine/risk-engine.service.ts`, the literal
 * source of every string matched below, which is always in English —
 * the backend doesn't localize finding text) and returns an honest,
 * jargon-free, urgency-appropriate version *in the reader's own UI
 * language* for someone with zero security background. This never changes
 * what was actually found — only how it's worded, in whichever language
 * the reader is already using — the same "real data, friendlier
 * presentation" pattern already used for the letter grade in
 * SecurityScoreCard.tsx. The original technical title/description are
 * still shown (in an expandable "technical detail" section in AlertCard),
 * so nothing is hidden — just not the default, leading view anymore.
 *
 * Deliberately dramatizes real consequences (a browser warning page,
 * unencrypted data in transit, a known attack technique) rather than
 * inventing scarier ones — "scary but true," not "scary and false."
 * Unrecognized finding titles fall back to the original (English)
 * text unchanged, so a future finding type this mapping doesn't yet cover
 * still displays correctly instead of silently breaking.
 */
export interface PlainLanguageFinding {
  headline: string;
  explanation: string;
}

export type PlainLanguageLocale = "en" | "he";

type Matcher = {
  test: RegExp;
  build: (
    match: RegExpMatchArray,
    locale: PlainLanguageLocale,
  ) => PlainLanguageFinding;
};

const MATCHERS: Matcher[] = [
  {
    test: /^No valid TLS certificate observed$/,
    build: (_m, locale) =>
      locale === "he"
        ? {
            headline: "האתר שלכם לא מאובטח",
            explanation:
              "לאתר שלכם אין אישור אבטחה תקין. סביר שמבקרים רואים עמוד אזהרה מפחיד במקום האתר שלכם, וכל מה שהם מקלידים — סיסמאות, פרטי כרטיס אשראי — לא מוגן בדרך.",
          }
        : {
            headline: "Your website is not secure",
            explanation:
              "Your site has no working security certificate. Visitors likely see a scary warning page instead of your site, and anything they type in — passwords, card numbers — isn't protected on the way there.",
          },
  },
  {
    test: /^Invalid TLS certificate$/,
    build: (_m, locale) =>
      locale === "he"
        ? {
            headline: "אבטחת האתר שלכם שבורה",
            explanation:
              "האישור שאמור להגן על האתר שלכם נכשל בבדיקה בסיסית. דפדפנים עשויים לחסום או להזהיר מבקרים מפני האתר שלכם ממש עכשיו.",
          }
        : {
            headline: "Your website's security is broken",
            explanation:
              "The certificate that's supposed to protect your site failed a basic check. Browsers may be actively blocking or warning visitors away from your site right now.",
          },
  },
  {
    test: /^Self-signed TLS certificate$/,
    build: (_m, locale) =>
      locale === "he"
        ? {
            headline: "אבטחת האתר שלכם אינה מהימנה",
            explanation:
              "אישור האבטחה של האתר שלכם לא הונפק על ידי גורם מוכר, אז דפדפנים לא סומכים עליו ומציגים למבקרים אזהרה — גם אם אתם יודעים שהאתר שלכם תקין.",
          }
        : {
            headline: "Your website's security isn't trusted",
            explanation:
              "Your site's security certificate wasn't issued by a recognized authority, so browsers don't trust it and show visitors a warning — even though you know your site is fine.",
          },
  },
  {
    test: /^TLS certificate has expired$/,
    build: (_m, locale) =>
      locale === "he"
        ? {
            headline: "אבטחת האתר שלכם פגה",
            explanation:
              "האישור ששומר על האתר שלכם מאובטח פג תוקף. כל מבקר רואה כעת אזהרה שהאתר שלכם אינו בטוח.",
          }
        : {
            headline: "Your website's security has expired",
            explanation:
              "The certificate that keeps your site secure has run out. Every visitor is now seeing a warning telling them your site isn't safe.",
          },
  },
  {
    test: /^TLS certificate expires within 7 days$/,
    build: (_m, locale) =>
      locale === "he"
        ? {
            headline: "אבטחת האתר שלכם פגה השבוע — פעלו עכשיו",
            explanation:
              "בעוד פחות משבוע, כל מבקר באתר שלכם יתחיל לראות אזהרת אבטחה אלא אם זה יחודש קודם.",
          }
        : {
            headline: "Your website's security expires this week — act now",
            explanation:
              "In less than 7 days, every visitor to your site will start seeing a security warning unless this gets renewed first.",
          },
  },
  {
    test: /^TLS certificate expires within 30 days$/,
    build: (_m, locale) =>
      locale === "he"
        ? {
            headline: "אבטחת האתר שלכם דורשת חידוש בקרוב",
            explanation:
              "אישור האבטחה של האתר שלכם פג תוך חודש. חדשו אותו לפני כן, אחרת מבקרים יתחילו לראות עמודי אזהרה.",
          }
        : {
            headline: "Your website's security needs renewing soon",
            explanation:
              "Your site's security certificate runs out within a month. Renew it before then, or visitors will start seeing warning pages.",
          },
  },
  {
    test: /^(\d+) recommended security header\(s\) missing$/,
    build: (m, locale) =>
      locale === "he"
        ? {
            headline: `לאתר שלכם חסרות ${m[1]} הגנות בסיסיות`,
            explanation:
              "חשבו על אלה כמו דלתות צד לא נעולות באתר שלכם. הן מקלות על תוקף לחטוף עמוד, לרמות דפדפן, או להחדיר קוד זדוני.",
          }
        : {
            headline: `Your website is missing ${m[1]} basic protection(s)`,
            explanation:
              "Think of these like unlocked side doors on your website. They make it easier for an attacker to hijack a page, trick a browser, or slip in malicious code.",
          },
  },
  {
    test: /^Server technology version disclosed in response headers$/,
    build: (_m, locale) =>
      locale === "he"
        ? {
            headline: "האתר שלכם חושף באיזו תוכנה הוא משתמש",
            explanation:
              "כל מי שמסתכל יכול לראות בדיוק איזו טכנולוגיה מפעילה את האתר שלכם — מה שמקל מאוד על תוקף למצוא ולנצל חולשה ידועה בגרסה המדויקת הזו.",
          }
        : {
            headline: "Your website is revealing what software it runs",
            explanation:
              "Anyone looking can see exactly what technology powers your site — making it much faster for an attacker to find and use a known weakness in that exact version.",
          },
  },
  {
    test: /^Large number of exposed IP addresses \((\d+)\)$/,
    build: (m, locale) =>
      locale === "he"
        ? {
            headline: `לאתר שלכם טביעת רגל ציבורית גדולה (${m[1]} כתובות)`,
            explanation:
              "כל כך הרבה כתובות נפרדות מובילות לתשתית שלכם. יותר נקודות כניסה אומר יותר מקומות שצריך לעקוב אחריהם.",
          }
        : {
            headline: `Your website has a large public footprint (${m[1]} addresses)`,
            explanation:
              "That many separate addresses lead to your infrastructure. More entry points means more places that need to be kept an eye on.",
          },
  },
  {
    test: /^(\d+) asset change\(s\) in the last 7 days$/,
    build: (m, locale) =>
      locale === "he"
        ? {
            headline: `משהו השתנה באתר שלכם השבוע (${m[1]} שינויים)`,
            explanation:
              "חלק מהנוכחות המקוונת שלכם הופיע או נעלם בשבעת הימים האחרונים. אם הצוות שלכם לא ביצע את השינוי הזה, כדאי לברר מי — או מה — כן.",
          }
        : {
            headline: `Something changed on your website this week (${m[1]} change(s))`,
            explanation:
              "Part of your online presence appeared or disappeared in the last 7 days. If your team didn't make this change, it's worth finding out who — or what — did.",
          },
  },
];

export function toPlainLanguage(
  title: string,
  fallbackDescription: string,
  locale: PlainLanguageLocale = "en",
): PlainLanguageFinding {
  for (const matcher of MATCHERS) {
    const match = title.match(matcher.test);
    if (match) return matcher.build(match, locale);
  }
  // Unrecognized finding type — show the real text unchanged rather than
  // guessing at a plain-language version that might not actually be
  // accurate.
  return { headline: title, explanation: fallbackDescription };
}
