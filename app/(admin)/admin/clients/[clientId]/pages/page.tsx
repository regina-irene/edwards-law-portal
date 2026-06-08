// app/(admin)/admin/clients/[clientId]/pages/page.tsx
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { startPreview } from "@/app/preview-actions"
import PageContentEditor from "@/components/admin/PageContentEditor"
import ClientPageToggles from "@/components/admin/ClientPageToggles"

async function resolveLabel(clientId: string): Promise<string> {
  try {
    const [clients, labels] = await Promise.all([fetchAllClientsRaw(), getClientLabels()])
    const match = clients.find((c) => String(c.clientId) === clientId)
    if (!match) return clientId
    return labels[clientId] || clientDisplayLabel(match.name) || clientId
  } catch {
    return clientId
  }
}

export default async function ClientPagesEditor({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const label = await resolveLabel(clientId)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Page Editor</h1>
          <p className="text-sm text-gray-500 mt-1">
            Client: <span className="font-medium">{label}</span> · Overrides the global defaults for this client only.
          </p>
        </div>
        <form action={startPreview.bind(null, clientId)}>
          <button type="submit" className="text-sm border border-blue-600 text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50">
            Preview portal as this client ↗
          </button>
        </form>
      </div>
      <ClientPageToggles clientId={clientId} />
      <PageContentEditor clientId={clientId} />
    </div>
  )
}
