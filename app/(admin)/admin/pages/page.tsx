// app/(admin)/admin/pages/page.tsx
import PageContentEditor from "@/components/admin/PageContentEditor"

export default function GlobalPagesEditor() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Global Page Defaults</h1>
        <p className="text-sm text-gray-500 mt-1">
          These apply to <strong>all clients</strong> unless overridden for a specific client via that client&apos;s Pages editor.
        </p>
      </div>
      <PageContentEditor clientId="_global" />
    </div>
  )
}
