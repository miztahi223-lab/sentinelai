import Image from "next/image";

/**
 * A stylized macOS-style browser chrome wrapping a real product screenshot.
 * Purely decorative framing — the screenshot itself (passed via `src`) is a
 * genuine, unedited capture of the live SentinelAI dashboard (see
 * `docs/PROGRESS.md`, "Enhancement: real product preview" for how it was
 * taken). No fabricated data is drawn here; this component only adds a
 * window frame and an address bar around a real screenshot.
 */
export function BrowserFrame({
  src,
  alt,
  url = "app.sentinelai.dev/dashboard",
}: {
  src: string;
  alt: string;
  url?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950 shadow-2xl shadow-indigo-950/40 ring-1 ring-white/5">
      <div className="flex items-center gap-2 border-b border-gray-800 bg-gray-900/80 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
        </div>
        <div className="mx-auto flex min-w-0 max-w-xs flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-950/80 px-3 py-1 text-xs text-gray-500">
          <span dir="ltr" className="truncate">
            {url}
          </span>
        </div>
      </div>
      <Image
        src={src}
        alt={alt}
        width={1600}
        height={440}
        className="w-full"
        priority
      />
    </div>
  );
}
