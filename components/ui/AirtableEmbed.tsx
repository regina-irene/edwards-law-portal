// components/ui/AirtableEmbed.tsx
interface AirtableEmbedProps {
  url: string
  title: string
  height?: number
}

// Airtable only allows its /embed/ URLs to be framed. Convert a normal shared
// view link (airtable.com/app.../shr...) into the embeddable form.
export function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url.trim())
    if (!/(^|\.)airtable\.com$/i.test(u.hostname)) return url
    if (u.pathname.startsWith("/embed/")) return url // already an embed link
    // Pull the base id (app...) and shared-view id (shr...) from anywhere in the
    // path and build the canonical embeddable URL, preserving query params.
    const app = u.pathname.match(/app[A-Za-z0-9]{10,}/)?.[0]
    const shr = u.pathname.match(/shr[A-Za-z0-9]+/)?.[0]
    if (shr) {
      const base = app ? `https://airtable.com/embed/${app}/${shr}` : `https://airtable.com/embed/${shr}`
      return base + (u.search || "")
    }
    // Fallback: just insert /embed into the path
    return `https://airtable.com/embed${u.pathname}${u.search}`
  } catch {}
  return url
}

export default function AirtableEmbed({ url, title, height = 600 }: AirtableEmbedProps) {
  const embedUrl = toEmbedUrl(url)
  if (!url) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-400">View not configured. Contact your attorney.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Desktop: iframe */}
      <div className="hidden md:block rounded-lg overflow-hidden border border-gray-200 shadow-sm">
        <iframe
          src={embedUrl}
          title={title}
          width="100%"
          height={height}
          className="block"
          frameBorder="0"
          allowFullScreen
          // A third-party embed competing for bandwidth during first paint is
          // a big chunk of why pages felt heavy. Only load it once it's near
          // the viewport. (2026-08-18)
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      {/* Mobile: fallback link */}
      <div className="md:hidden">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Open {title} ↗
        </a>
      </div>

      {/* Always show open-in-new-tab link */}
      <p className="text-xs text-gray-400">
        <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          View {title} in new tab ↗
        </a>
      </p>
    </div>
  )
}
