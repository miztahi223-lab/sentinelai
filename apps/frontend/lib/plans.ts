export interface PlanInfo {
  name: string;
  price: string;
  plan?: "STARTER" | "PROFESSIONAL" | "BUSINESS";
  description: string;
  features: string[];
}

export const PLANS: PlanInfo[] = [
  {
    name: "Free",
    price: "$0",
    description: "Try SentinelAI on a single domain.",
    features: ["1 domain", "Weekly scans", "Security score & findings", "Community support"],
  },
  {
    name: "Starter",
    price: "$49/mo",
    plan: "STARTER",
    description: "For a small team watching a handful of properties.",
    features: ["5 domains", "Daily scans", "Email alerts", "Security score & findings"],
  },
  {
    name: "Professional",
    price: "$199/mo",
    plan: "PROFESSIONAL",
    description: "For teams that need AI-assisted remediation and reporting.",
    features: [
      "25 domains",
      "Daily scans",
      "AI-generated remediation guidance",
      "PDF report export & email delivery",
    ],
  },
  {
    name: "Business",
    price: "Custom",
    plan: "BUSINESS",
    description: "For organizations with a large or fast-changing attack surface.",
    features: [
      "Unlimited domains",
      "Real-time monitoring",
      "SSO",
      "Priority support",
    ],
  },
];
