"use client";

import { useState } from "react";
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
  Menu,
  X,
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

  // Below `lg`, the sidebar is a slide-in drawer over the page rather than
  // a permanent column — a fixed w-64 column left always-on had no mobile
  // fallback at all, so on a real phone viewport it just squeezed every
  // dashboard page's content into a sliver next to it (found while testing
  // the redesigned dashboard on a real 390px viewport, not something the
  // dashboard pages themselves could fix).
  const [mobileOpen, setMobileOpen] = useState(false);

  // Closing on navigation (rather than leaving it open across a route
  // change) matches how every mobile drawer nav behaves — the link click
  // itself already signals intent to leave this screen. Derived during
  // render rather than via a `useEffect`, the same "adjust state when a
  // prop changes" pattern already established in `auth-context.tsx`/
  // `organization-context.tsx` (an effect here would cause an extra,
  // avoidable render on every navigation).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  return (
    <>
      <div className="flex h-14 items-center justify-between border-b border-gray-800 bg-gray-950 px-4 lg:hidden">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-white">
          Sentinel<span className="text-indigo-400">AI</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={t("openMenu")}
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-gray-300 transition hover:bg-gray-900 hover:text-white"
        >
          <Menu className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute end-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>
      </div>

      {mobileOpen && (
        // A real `<button>` (not a bare `<div onClick>`) — natively
        // focusable and keyboard-activatable (Enter/Space), so keyboard and
        // screen-reader users can dismiss the drawer the same way a mouse
        // user clicking the backdrop can, not just via the separate close
        // button inside the drawer itself.
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label={t("closeMenu")}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 start-0 z-40 flex h-screen w-64 shrink-0 flex-col border-e border-gray-800 bg-gray-950 px-4 py-6 transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <Link href="/dashboard" className="text-xl font-semibold tracking-tight text-white">
            Sentinel<span className="text-indigo-400">AI</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={t("closeMenu")}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-900 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

      {/* Org switcher — only shown once a user actually belongs to more
          than one organization (the common case: just their own). Team
          invitations are what make a second org possible, so this stays
          hidden rather than cluttering the sidebar for everyone. */}
      {organizations.length > 1 ? (
        <div className="relative mb-4">
          <Building2 className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select
            value={currentOrg?.id ?? ""}
            onChange={(e) => setCurrentOrgId(e.target.value)}
            aria-label={t("switchOrg")}
            className="w-full appearance-none rounded-md border border-gray-800 bg-gray-900/60 py-2 ps-8 pe-2 text-sm font-medium text-gray-200 outline-none transition hover:border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
          <p className="mb-4 truncate px-2 text-xs font-medium text-gray-400">
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
        <p className="truncate px-2 text-xs text-gray-400">{user?.email}</p>
        <button
          onClick={() => logout()}
          className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-400 transition hover:bg-gray-900 hover:text-gray-200"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {t("signOut")}
        </button>
      </div>
      </aside>
    </>
  );
}
