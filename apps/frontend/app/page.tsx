import Link from "next/link";

// Placeholder root page — the real marketing landing page (headline, pricing,
// features, CTA) is Step 14 of the build and isn't implemented yet. This is
// just functional navigation so the app isn't stuck on the default
// create-next-app template while auth/dashboard are being built.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-white">
        Sentinel<span className="text-indigo-400">AI</span>
      </h1>
      <p className="max-w-md text-sm text-gray-400">
        Know what attackers can see before they do. (Landing page content —
        pricing, features — is Step 14 of the build, not implemented yet.)
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-900"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
        >
          Start free trial
        </Link>
      </div>
    </div>
  );
}
