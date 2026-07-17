// components/ui/PageHeader.tsx
import type { PageContent } from "@/lib/page-content"
import { RichTextView } from "@/components/ui/RichTextEditor"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import PageTitle from "@/components/ui/PageTitle"
import { taglineFor } from "@/lib/taglines"

interface PageHeaderProps {
  defaultTitle: string
  page: string
  content: PageContent
}

export default function PageHeader({ defaultTitle, page, content }: PageHeaderProps) {
  const title = content.header || defaultTitle
  return (
    <div className="space-y-4">
      <PageTitle title={title} tagline={taglineFor(page)} />

      {content.announcement && (
        /* per-page announcement: full width, centered, translucent so it
           blends with the page background (firm-wide banner is in the layout) */
        <div
          className="w-full px-5 py-3 rounded-lg text-sm keep-ink text-center"
          style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(0,0,0,0.06)", color: "#1b2d45" }}
        >
          <RichTextView html={content.announcement} className="!text-[#1b2d45]" />
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <RichTextView html={content.body} />
        </div>
      )}

      {content.embed_url && <AirtableEmbed url={content.embed_url} title={title} height={content.embed_height ?? undefined} />}
    </div>
  )
}
