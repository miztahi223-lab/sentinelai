import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-gray-800">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-gray-500 sm:flex-row">
        <p>&copy; {new Date().getFullYear()} SentinelAI. All rights reserved.</p>
        <div className="flex gap-6">
          <Link href="/features" className="hover:text-gray-300">
            Features
          </Link>
          <Link href="/pricing" className="hover:text-gray-300">
            Pricing
          </Link>
          <Link href="/contact" className="hover:text-gray-300">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
