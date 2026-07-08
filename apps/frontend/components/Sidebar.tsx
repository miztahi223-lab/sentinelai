"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  LayoutDashboard,
  Globe2,
  FileText,
  Bell,
  Settings,
  CreditCard,
  LogOut,
  Building2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/organization-context";
import { useAlerts } from "@/lib/hooks";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const NAV_ITEMS = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/domains", key: "domains", icon: Globe2 },
  { href: "/reports", key: "reports", icon: FileText },
  { href: "/alerts", key: "alerts", icon: Bell },
  { href: "/settings", key: "settings", icon: Settings },
  { href: "/billing", key: "billing", icon: CreditCard },
] as const;

export function Sidebar() {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { organizations, currentOrg, setCurrentOrgId } = useOrganization();
  // Polled (React Query default refetch-on-window-focus already covers
  // "came back to the tab"), not real-time push — good enough for a
  // sidebar badge without adding a websocket/SSE layer this build doesn't
  // otherwise have.
  const { data: alerts } = useAlerts(currentOrg?.id);
  const unreadCount = alerts?.filter((a) => !a.read).length ?? 0;

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-e border-gray-800 bg-gray-950 px-4 py-6">
      <Link href="/dashboard" className="mb-6 px-2 text-xl font-semibold tracking-tight text-white">
        Sentinel<span className="text-indigo-400">AI</span>
      </Link>

      {/* Org switcher — only shown once a user actually belongs to more
          than one organization (the common case: just their own). Team
          invitations are what make a second org possible, so this stays
          hidden rather than cluttering the sidebar for everyone. */}
      {organizations.length > 1 ? (
        <div className="relative mb-4">
          <Building2 className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <select
            value={currentOrg?.id ?? ""}
            onChange={(e) => setCurrentOrgId(e.target.value)}
            aria-label={t("switchOrg")}
            className="w-full appearance-none rounded-md border border-gray-800 bg-gray-900/60 py-2 ps-8 pe-2 text-sm font-medium text-gray-200 outline-none transition hover:border-gray-700 focus:border-indigo-500"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        currentOrg && (
          <p className="mb-4 truncate px-2 text-xs font-medium text-gray-500">
            {currentOrg.name}
          </p>
        )
      )}

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-indigo-500/10 text-indigo-300"
                  : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{t(key)}</span>
              {key === "alerts" && unreadCount > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 pt-4">
        <LanguageSwitcher className="mb-3 w-full justify-center" />
        <p className="truncate px-2 text-xs text-gray-500">{user?.email}</p>
        <button
          onClick={() => logout()}
          className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-400 transition hover:bg-gray-900 hover:text-gray-200"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {t("signOut")}
        </button>
      </div>
    </aside>
  );
}
