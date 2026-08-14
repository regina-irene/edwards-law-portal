// app/(admin)/admin/forms/[formKey]/page.tsx — who has answered this form.
import Link from "next/link"
import { redirect } from "next/navigation"
import PageTitle from "@/components/ui/PageTitle"
import { requireAdmin } from "@/lib/admin"
import { getPortalForm, countFields } from "@/lib/portal-forms"
import { getForm } from "@/lib/fileflow"
import { clientsWithAnswers } from "@/lib/form-responses"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"

export const dynamic = "force-dynamic"

function fmt(d: string): string {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })
}

export default async function FormAnswersPage({ params }: { params: Promise<{ formKey: string }> }) {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  const { formKey } = await params
  const key = decodeURIComponent(formKey)

  const portal = await getPortalForm(key).catch(() => null)
  const definition = portal ? portal.definition : await getForm(key).catch(() => null)

  const [responders, clients, labels] = await Promise.all([
    clientsWithAnswers(key).catch(() => []),
    fetchAllClientsRaw().catch(() => []),
    getClientLabels().catch(() => ({}) as Record<string, string>),
  ])

  const labelOf = (id: string) => {
    const match = clients.find((c) => String(c.clientId) === id)
    return labels[id] || (match ? clientDisplayLabel(match.name) : "") || id
  }

  const total = definition ? countFields(definition) : 0

  return (
    <div className="space-y-6 max-w-3xl">
      <PageTitle
        title={definition?.label ?? key}
        tagline="Completed answers — open one to read, print or export it"
        actions={<Link href="/admin/forms" className="text-sm underline text-gray-500 hover:text-gray-900">← All forms</Link>}
      />

      {!definition && (
        <p className="text-sm text-red-600 bg-white rounded-xl border border-red-200 p-4">
          This form&apos;s questions couldn&apos;t be loaded, so answers can&apos;t be laid out against them.
        </p>
      )}

      {responders.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">
          Nobody has answered this form yet. Link it to a task on the{" "}
          <Link href="/admin/tasks" className="underline">Tasks</Link> screen and assign that task to a client.
        </p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {responders.map((r) => (
            <Link
              key={r.clientId}
              href={`/admin/forms/${encodeURIComponent(key)}/${encodeURIComponent(r.clientId)}`}
              className="flex items-baseline justify-between gap-4 px-5 py-3.5 hover:bg-gray-50"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{labelOf(r.clientId)}</p>
                <p className="text-sm text-gray-500">
                  {r.answers} of {total || "?"} answered
                </p>
              </div>
              <span className="shrink-0 text-xs text-gray-400">{fmt(r.updatedAt)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
