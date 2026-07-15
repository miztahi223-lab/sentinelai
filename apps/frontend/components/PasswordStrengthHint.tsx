import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";

// Mirrors the backend's actual rule exactly (`StrongPassword` in
// `apps/backend/src/common/decorators/strong-password.decorator.ts`) — this
// is a live preview of that real server-side check, not a separate
// cosmetic client-side rule that could drift from what the server will
// actually accept.
export function passwordMeetsRequirements(password: string): boolean {
  return (
    password.length >= 12 &&
    password.length <= 128 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^a-zA-Z0-9]/.test(password)
  );
}

interface Requirement {
  labelKey:
    | "passwordRequirement_length"
    | "passwordRequirement_lowercase"
    | "passwordRequirement_uppercase"
    | "passwordRequirement_number"
    | "passwordRequirement_symbol";
  met: boolean;
}

function computeRequirements(password: string): Requirement[] {
  return [
    { labelKey: "passwordRequirement_length", met: password.length >= 12 },
    { labelKey: "passwordRequirement_lowercase", met: /[a-z]/.test(password) },
    { labelKey: "passwordRequirement_uppercase", met: /[A-Z]/.test(password) },
    { labelKey: "passwordRequirement_number", met: /[0-9]/.test(password) },
    { labelKey: "passwordRequirement_symbol", met: /[^a-zA-Z0-9]/.test(password) },
  ];
}

/**
 * A live checklist under a password field — shown once the user starts
 * typing, each line flips from neutral to a real green check the instant
 * that specific requirement is actually met, so a rejected password never
 * arrives as a surprise 400 after submitting. Requirements match
 * `passwordMeetsRequirements` above 1:1.
 */
export function PasswordStrengthHint({ password }: { password: string }) {
  const t = useTranslations("auth");
  if (!password) return null;
  const requirements = computeRequirements(password);

  return (
    <ul className="mt-2 space-y-1" aria-live="polite">
      {requirements.map(({ labelKey, met }) => (
        <li
          key={labelKey}
          className={`flex items-center gap-1.5 text-xs transition ${
            met ? "text-emerald-400" : "text-gray-500"
          }`}
        >
          {met ? (
            <Check size={13} aria-hidden="true" />
          ) : (
            <X size={13} aria-hidden="true" />
          )}
          {t(labelKey)}
        </li>
      ))}
    </ul>
  );
}
