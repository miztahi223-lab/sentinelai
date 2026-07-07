import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'he'],
  defaultLocale: 'en',
  // Always show the locale prefix (/en/..., /he/...) rather than hiding it
  // for the default locale — makes the current language unambiguous from
  // the URL alone, which matters for a bilingual product where either
  // language is a genuinely first-class option, not an afterthought.
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

// `he` is the only right-to-left locale this app supports today; kept as
// its own lookup (rather than inlining `locale === 'he'` at every call
// site) so adding a second RTL locale later is a one-line change here, not
// a find-and-replace across the app.
export function directionForLocale(locale: string): 'ltr' | 'rtl' {
  return locale === 'he' ? 'rtl' : 'ltr';
}
