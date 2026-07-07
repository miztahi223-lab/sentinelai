export type SubscriptionPlanKey = "FREE" | "STARTER" | "PROFESSIONAL" | "BUSINESS";

export interface PlanInfo {
  // Stable, locale-independent identifier matching the backend's
  // `SubscriptionPlan` enum — used for "is this the user's current plan?"
  // comparisons. `name` is the translated *display* label and must never
  // be used for that comparison (it reads correctly in the UI but isn't a
  // stable identifier once it's translated — "Free" vs "חינם").
  key: SubscriptionPlanKey;
  name: string;
  price: string;
  plan?: "STARTER" | "PROFESSIONAL" | "BUSINESS";
  description: string;
  features: string[];
}

// Prices are deliberately NOT translated/localized to a different currency
// per-locale — this is a single-currency (USD) product today, so a plain
// dollar figure stays a plain dollar figure regardless of UI language,
// same as most bilingual SaaS pricing pages do until real multi-currency
// billing exists.
const PRICES: Record<"free" | "starter" | "professional" | "business", string> = {
  free: "$0",
  starter: "$49/mo",
  professional: "$199/mo",
  business: "Custom",
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
      price: PRICES.free,
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
      price: PRICES.starter,
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
      price: PRICES.professional,
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
      price: PRICES.business,
      plan: "BUSINESS",
      description: t("business.description"),
      features: [
        t("business.feature1"),
        t("business.feature2"),
        t("business.feature3"),
        t("business.feature4"),
      ],
    },
  ];
}
