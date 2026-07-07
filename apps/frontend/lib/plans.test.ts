import { describe, expect, it } from "vitest";
import { PLANS } from "./plans";

const VALID_STRIPE_PLAN_KEYS = ["STARTER", "PROFESSIONAL", "BUSINESS"];

describe("PLANS", () => {
  it("has exactly one Free plan with no Stripe plan key", () => {
    const free = PLANS.filter((p) => p.name === "Free");
    expect(free).toHaveLength(1);
    expect(free[0].plan).toBeUndefined();
  });

  it("every paid plan has a Stripe plan key matching the backend's SubscriptionPlan enum", () => {
    const paidPlans = PLANS.filter((p) => p.name !== "Free");
    expect(paidPlans.length).toBeGreaterThan(0);
    for (const plan of paidPlans) {
      expect(plan.plan).toBeDefined();
      expect(VALID_STRIPE_PLAN_KEYS).toContain(plan.plan);
    }
  });

  it("every plan has at least one feature listed", () => {
    for (const plan of PLANS) {
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate plan names (would break the billing page's 'current plan' matching)", () => {
    const names = PLANS.map((p) => p.name.toUpperCase());
    expect(new Set(names).size).toBe(names.length);
  });
});
