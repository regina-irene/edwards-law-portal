// components/ui/PageTitle.tsx — Thistle-style page heading: big serif title
// (h1 renders in Libre Baskerville via globals.css) + one-line tagline.
// Shared by the client PageHeader and admin pages.
interface PageTitleProps {
  title: string
  tagline?: string | null
  actions?: React.ReactNode
}

export default function PageTitle({ title, tagline, actions }: PageTitleProps) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h1 className="page-title text-3xl md:text-4xl font-bold" style={{ color: "var(--scheme-heading, #111827)" }}>{title}</h1>
        {tagline && <p className="mt-1.5 text-[15px]" style={{ color: "#3a5170" }}>{tagline}</p>}
      </div>
      {actions && <div className="shrink-0 pb-1">{actions}</div>}
    </div>
  )
}
