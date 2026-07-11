import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import en from "../messages/en.json";

// Component tests exercise the real English message file (not a fake/mock
// translation dictionary) — the same source of truth the actual app renders
// with — since any component under test now calls `useTranslations`/
// `useLocale` internally and needs a real `NextIntlClientProvider` ancestor
// to not throw. A fresh `QueryClient` per render (retries off, so a
// component that fires a mutation/query on mount fails fast instead of
// retrying into the test's timeout) covers any component that calls a
// React Query hook (`useMutation`/`useQuery`) internally.
function AllProviders({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={en}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

export function renderWithIntl(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: AllProviders, ...options });
}
