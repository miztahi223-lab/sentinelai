"use client";

import { createContext, useContext, useState } from "react";
import { useOrganizations, type Organization } from "./hooks";

interface OrganizationContextValue {
  organizations: Organization[];
  currentOrg: Organization | undefined;
  setCurrentOrgId: (id: string) => void;
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

const STORAGE_KEY = "sentinelai_current_org_id";

/**
 * Added once team invitations (a real member can now belong to more than
 * one organization — their own from registration, plus any they're
 * invited into) made "just use the first organization in the list" an
 * actual, reproducible bug: an invited member's own dashboard silently
 * showed their unrelated personal org instead of the one they were
 * actually invited to look at, with no way to switch. This context is the
 * fix — a single source of truth for "which org's data is the dashboard
 * currently showing", persisted in localStorage so it survives a reload.
 *
 * The effective org id is *derived* during render (explicit user
 * selection → localStorage → first membership), not synced via a
 * `useEffect` + `setState` — deliberately: an effect that calls setState
 * purely to mirror already-available data (the query result + localStorage)
 * causes an extra render pass for no benefit and trips
 * `react-hooks/set-state-in-effect` (the exact issue already fixed once in
 * `auth-context.tsx`; same fix applied here for the same reason).
 */
export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { data: organizations, isLoading } = useOrganizations();
  // Only sees a value once the user *explicitly* switches — everything
  // else is derived below, not written here.
  const [manualOrgId, setManualOrgId] = useState<string | undefined>(undefined);

  function setCurrentOrgId(id: string) {
    setManualOrgId(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  }

  let currentOrg: Organization | undefined;
  if (organizations && organizations.length > 0) {
    const storedOrgId =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const candidateId = manualOrgId ?? storedOrgId;
    currentOrg =
      (candidateId && organizations.find((o) => o.id === candidateId)) ||
      organizations[0];
  }

  return (
    <OrganizationContext.Provider
      value={{
        organizations: organizations ?? [],
        currentOrg,
        setCurrentOrgId,
        isLoading,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrganizationContextValue {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return ctx;
}
