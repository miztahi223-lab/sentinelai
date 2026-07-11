export type SubscriptionPlanKey =
  | "FREE"
  | "STARTER"
  | "PROFESSIONAL"
  | "BUSINESS"
  // Not a real value of the backend's `SubscriptionPlan` enum — Enterprise
  // is a contact-sales, manually-provisioned tier (real SaaS enterprise
  // tiers almost always are), so it never appears as an org's actual
  // `subscription.plan` and the "is this the user's current plan?"
  // comparison simply never matches it. It exists here only so the pricing
  // page has one shared source of truth for every tier it displays.
  | "ENTERPRISE";

export type BillingInterval = "monthly" | "yearly";

export interface PlanInfo {
  // Stable, locale-independent identifier matching the backend's
  // `SubscriptionPlan` enum — used for "is this the user's current plan?"
  // comparisons. `name` is the translated *display* label and must never
  // be used for that comparison (it reads correctly in the UI but isn't a
  // stable identifier once it's translated — "Free" vs "חינם").
  key: SubscriptionPlanKey;
  name: string;
  // Monthly-equivalent display price — kept for the billing settings page
  // (Step 13), which only ever offers monthly checkout today. The public
  // pricing page (Enhancement 27) shows `priceMonthly`/`priceYearly`
  // instead so it can toggle between them.
  price: string;
  priceMonthly: string;
  priceYearly: string;
  plan?: "STARTER" | "PROFESSIONAL" | "BUSINESS";
  // True for tiers with no fixed, self-serve price (Business remains a
  // real fixed Stripe price today — see `PLAN_PRICE_ENV_VAR` in the
  // backend's `billing.service.ts` — Enterprise is the first tier that
  // genuinely has none). The pricing page renders these with a "Contact
  // sales" link instead of a self-serve checkout button.
  isCustomQuote?: boolean;
  description: string;
  features: string[];
}

// Prices are deliberately NOT translated/localized to a different currency
// per-locale — this is a single-currency (USD) product today, so a plain
// dollar figure stays a plain dollar figure regardless of UI language,
// same as most bilingual SaaS pricing pages do until real multi-currency
// billing exists.
//
// Yearly figures are a real pricing decision (10x the monthly price — two
// months free, a standard SaaS annual-discount convention), the same kind
// of decision the existing monthly figures already are — not something
// "fetched" from anywhere. Whoever configures real Stripe Price objects
// for `STRIPE_PRICE_*_YEARLY` (see billing.service.ts) needs to configure
// them to match these numbers.
const PRICES: Record<
  "free" | "starter" | "professional" | "business",
  { monthly: string; yearly: string }
> = {
  free: { monthly: "$0", yearly: "$0" },
  starter: { monthly: "$49/mo", yearly: "$490/yr" },
  professional: { monthly: "$199/mo", yearly: "$1,990/yr" },
  business: { monthly: "Custom", yearly: "Custom" },
};

// Takes a translation function (the return value of next-intl's
// `useTranslations("plans")` / `getTranslations("plans")`) rather than
// hardcoding English strings here, so this single source of truth for
// plan *structure* (which plans exist, their Stripe plan keys, feature
// count) can't drift from the actual copy shown to users in either
// language — the shared billing/pricing pages and this module's own test
// (`plans.test.ts`) all exercise the exact same function.
export function getPlans(t: (key: string) => string): PlanInfo[] {
  return [
    {
      key: "FREE",
      name: t("free.name"),
      price: PRICES.free.monthly,
      priceMonthly: PRICES.free.monthly,
      priceYearly: PRICES.free.yearly,
      description: t("free.description"),
      features: [
        t("free.feature1"),
        t("free.feature2"),
        t("free.feature3"),
        t("free.feature4"),
      ],
    },
    {
      key: "STARTER",
      name: t("starter.name"),
      price: PRICES.starter.monthly,
      priceMonthly: PRICES.starter.monthly,
      priceYearly: PRICES.starter.yearly,
      plan: "STARTER",
      description: t("starter.description"),
      features: [
        t("starter.feature1"),
        t("starter.feature2"),
        t("starter.feature3"),
        t("starter.feature4"),
      ],
    },
    {
      key: "PROFESSIONAL",
      name: t("professional.name"),
      price: PRICES.professional.monthly,
      priceMonthly: PRICES.professional.monthly,
      priceYearly: PRICES.professional.yearly,
      plan: "PROFESSIONAL",
      description: t("professional.description"),
      features: [
        t("professional.feature1"),
        t("professional.feature2"),
        t("professional.feature3"),
        t("professional.feature4"),
      ],
    },
    {
      key: "BUSINESS",
      name: t("business.name"),
      price: PRICES.business.monthly,
      priceMonthly: PRICES.business.monthly,
      priceYearly: PRICES.business.yearly,
      plan: "BUSINESS",
      description: t("business.description"),
      features: [
        t("business.feature1"),
        t("business.feature2"),
        t("business.feature3"),
        t("business.feature4"),
      ],
    },
    {
      key: "ENTERPRISE",
      name: t("enterprise.name"),
      price: "Custom",
      priceMonthly: "Custom",
      priceYearly: "Custom",
      isCustomQuote: true,
      description: t("enterprise.description"),
      features: [
        t("enterprise.feature1"),
        t("enterprise.feature2"),
        t("enterprise.feature3"),
        t("enterprise.feature4"),
      ],
    },
  ];
}
