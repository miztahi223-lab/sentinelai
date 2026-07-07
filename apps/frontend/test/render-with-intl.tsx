import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import en from "../messages/en.json";

// Component tests exercise the real English message file (not a fake/mock
// translation dictionary) — the same source of truth the actual app renders
// with — since any component under test now calls `useTranslations`/
// `useLocale` internally and needs a real `NextIntlClientProvider` ancestor
// to not throw.
function AllProviders({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      {children}
    </NextIntlClientProvider>
  );
}

export function renderWithIntl(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: AllProviders, ...options });
}
