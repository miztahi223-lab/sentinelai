import type en from './messages/en.json';

// Gives `useTranslations`/`getTranslations` full autocomplete + compile-time
// checking of translation keys against the actual shape of messages/en.json
// (the canonical source of truth for which keys must exist — messages/he.json
// is verified to have exactly the same key set by a script, not by the type
// system, since TypeScript can't statically diff two JSON files against each
// other).
declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof en;
  }
}
