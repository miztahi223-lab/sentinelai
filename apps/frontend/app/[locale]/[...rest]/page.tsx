import { notFound } from "next/navigation";

// A catch-all so any otherwise-unmatched path under a valid locale prefix
// (e.g. `/he/some-typo`) actually resolves to *this* route tree — which is
// what makes Next.js render the nearby `app/[locale]/not-found.tsx` (styled,
// translated) instead of falling all the way back to the framework's
// generic, unstyled, English-only root 404. Verified this exact gap live:
// without this file, `/he/nonexistent-page` rendered the plain default
// Next.js 404 page, not the custom one.
export default function CatchAll(): never {
  notFound();
}
