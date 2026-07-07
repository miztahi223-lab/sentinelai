import { describe, expect, it } from "vitest";
import { getPlans } from "./plans";
import en from "../messages/en.json";
import he from "../messages/he.json";

const VALID_STRIPE_PLAN_KEYS = ["STARTER", "PROFESSIONAL", "BUSINESS"];

// A tiny real translator over the actual shipped message files (not a fake
// mock dictionary) — reads dotted keys like `useTranslations("plans")`'s
// returned function would, e.g. `t("starter.feature1")`.
function translatorFor(messages: typeof en) {
  return (key: string): string => {
    const value = key
      .split(".")
      .reduce<unknown>(
        (obj, part) => (obj as Record<string, unknown>)?.[part],
        messages.plans,
      );
    if (typeof value !== "string") {
      throw new Error(`Missing translation for plans.${key}`);
    }
    return value;
  };
}

describe.each([
  ["en", translatorFor(en)],
  ["he", translatorFor(he)],
])("getPlans (%s)", (_locale, t) => {
  const plans = getPlans(t);

  it("has exactly one Free plan with no Stripe plan key", () => {
    const free = plans.filter((p) => p.key === "FREE");
    expect(free).toHaveLength(1);
    expect(free[0].plan).toBeUndefined();
  });

  it("every paid plan has a Stripe plan key matching the backend's SubscriptionPlan enum", () => {
    const paidPlans = plans.filter((p) => p.key !== "FREE");
    expect(paidPlans.length).toBeGreaterThan(0);
    for (const plan of paidPlans) {
      expect(plan.plan).toBeDefined();
      expect(VALID_STRIPE_PLAN_KEYS).toContain(plan.plan);
    }
  });

  it("every plan has at least one non-empty feature listed", () => {
    for (const plan of plans) {
      expect(plan.features.length).toBeGreaterThan(0);
      for (const feature of plan.features) {
        expect(feature.length).toBeGreaterThan(0);
      }
    }
  });

  it("has no duplicate stable plan keys (would break the billing page's 'current plan' matching)", () => {
    const keys = plans.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every plan has a non-empty translated name and description", () => {
    for (const plan of plans) {
      expect(plan.name.length).toBeGreaterThan(0);
      expect(plan.description.length).toBeGreaterThan(0);
    }
  });
});

it("the Free plan's display name is genuinely translated, not left in English for Hebrew", () => {
  const enPlans = getPlans(translatorFor(en));
  const hePlans = getPlans(translatorFor(he));
  const enFree = enPlans.find((p) => p.key === "FREE")!;
  const heFree = hePlans.find((p) => p.key === "FREE")!;
  expect(enFree.name).toBe("Free");
  expect(heFree.name).not.toBe(enFree.name);
});
