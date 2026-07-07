import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Locale-aware wrappers around Next's Link/useRouter/usePathname/redirect —
// using these instead of the plain `next/link`/`next/navigation` versions
// everywhere means navigation automatically preserves the current locale
// (e.g. clicking a link while on `/he/pricing` stays on `/he/...`) without
// every single call site having to remember to prefix the locale itself.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
