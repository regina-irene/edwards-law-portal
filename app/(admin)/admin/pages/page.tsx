// app/(admin)/admin/pages/page.tsx
import PageContentEditor from "@/components/admin/PageContentEditor"
import PageTitle from "@/components/ui/PageTitle"
import { taglineFor } from "@/lib/taglines"

export default function GlobalPagesEditor() {
  return (
    <div className="space-y-6">
      <div>
        <PageTitle title="Global Page Defaults" tagline={taglineFor("admin:pages")} />
        <p className="text-sm text-gray-500 mt-1">
          These apply to <strong>all clients</strong>{" "}unless overridden for a specific client via that client&apos;s Pages editor.
        </p>
      </div>
      <p className="text-xs text-gray-500">Pick a page below to edit it. The checkbox sets whether it shows for clients by default (override per client in their Pages editor).</p>
      <PageContentEditor clientId="_global" allowRename layout="tabs" />
    </div>
  )
}
