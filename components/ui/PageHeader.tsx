// components/ui/PageHeader.tsx
import type { PageContent } from "@/lib/page-content"
import { RichTextView } from "@/components/ui/RichTextEditor"
import AirtableEmbed from "@/components/ui/AirtableEmbed"

interface PageHeaderProps {
  defaultTitle: string
  page: string
  content: PageContent
}

export default function PageHeader({ defaultTitle, page, content }: PageHeaderProps) {
  const title = content.header || defaultTitle
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>

      {content.announcement && (
        /* FileFlow-style firm announcement: megaphone + full-width banner, centered */
        <div className="w-full px-5 py-3.5 rounded-lg text-sm flex items-center gap-4 keep-ink" style={{ background: "#efe2d2", border: "1px solid #e8dfd2", color: "#1b2d45" }}>
          <span className="text-3xl shrink-0" aria-hidden>📣</span>
          <div className="flex-1 text-center">
            <RichTextView html={content.announcement} className="!text-[#1b2d45]" />
          </div>
        </div>
      )}

      {content.image_pathname && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/page-image/${page}`}
          alt={content.image_name || title}
          className="rounded-lg border border-gray-200 max-h-72 w-auto"
        />
      )}

      {content.body && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <RichTextView html={content.body} />
        </div>
      )}

      {content.embed_url && <AirtableEmbed url={content.embed_url} title={title} height={content.embed_height ?? undefined} />}
    </div>
  )
}
