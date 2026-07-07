import Link from "next/link";

export function MarketingNav() {
  return (
    <header className="border-b border-gray-800">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-semibold tracking-tight text-white">
          Sentinel<span className="text-indigo-400">AI</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm text-gray-400 sm:flex">
          <Link href="/features" className="hover:text-gray-200">
            Features
          </Link>
          <Link href="/pricing" className="hover:text-gray-200">
            Pricing
          </Link>
          <Link href="/contact" className="hover:text-gray-200">
            Contact
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Start free trial
          </Link>
        </div>
      </nav>
    </header>
  );
}
