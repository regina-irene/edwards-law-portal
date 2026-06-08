// components/ui/AirtableEmbed.tsx
interface AirtableEmbedProps {
  url: string
  title: string
}

// Airtable only allows its /embed/ URLs to be framed. Convert a normal shared
// view link (airtable.com/app.../shr...) into the embeddable form.
function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url)
    if (/(^|\.)airtable\.com$/i.test(u.hostname) && !u.pathname.startsWith("/embed/")) {
      const m = url.match(/shr[A-Za-z0-9]+/)
      if (m) return `https://airtable.com/embed/${m[0]}${u.search}`
    }
  } catch {}
  return url
}

export default function AirtableEmbed({ url, title }: AirtableEmbedProps) {
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
          height="600"
          className="block"
          frameBorder="0"
          allowFullScreen
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
