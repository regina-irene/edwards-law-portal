// app/(admin)/admin/forms/[formKey]/[clientId]/page.tsx - one client's
// completed form, laid out question-by-question so it reads like the paper
// form. Print/PDF and CSV export both work from here.
import Link from "next/link"
import { redirect } from "next/navigation"
import PageTitle from "@/components/ui/PageTitle"
import PrintButton from "@/components/ui/PrintButton"
import FormExportButtons from "@/components/admin/forms/FormExportButtons"
import { requireAdmin } from "@/lib/admin"
import { getPortalForm } from "@/lib/portal-forms"
import { getForm } from "@/lib/fileflow"
import { loadAnswers, buildCompletedForm } from "@/lib/form-responses"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { markFormReviewed } from "@/lib/form-review"

export const dynamic = "force-dynamic"

export default async function CompletedFormPage({
  params,
}: {
  params: Promise<{ formKey: string; clientId: string }>
}) {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  const { formKey, clientId } = await params
  const key = decodeURIComponent(formKey)
  const cid = decodeURIComponent(clientId)

  const portal = await getPortalForm(key).catch(() => null)
  const definition = portal ? portal.definition : await getForm(key).catch(() => null)

  const [{ values, updatedAt }, clients, labels] = await Promise.all([
    loadAnswers(cid, key).catch(() => ({ values: {} as Record<string, string>, updatedAt: null })),
    fetchAllClientsRaw().catch(() => []),
    getClientLabels().catch(() => ({}) as Record<string, string>),
  ])

  // Opening this page IS reading the answers, so the dashboard's "Forms to
  // review" count clears here. Not awaited: it must never delay or fail the
  // page she came here to read.
  void markFormReviewed(cid, key)

  const match = clients.find((c) => String(c.clientId) === cid)
  const clientLabel = labels[cid] || (match ? clientDisplayLabel(match.name) : "") || cid

  if (!definition) {
    return (
      <div className="space-y-6 max-w-3xl">
        <PageTitle title="Completed form" tagline={clientLabel} />
        <p className="text-sm text-red-600 bg-white rounded-xl border border-red-200 p-4">
          This form&apos;s questions couldn&apos;t be loaded, so the answers can&apos;t be shown against them.
        </p>
      </div>
    )
  }

  const completed = buildCompletedForm(cid, definition, values, updatedAt)

  return (
    <div className="space-y-6 max-w-3xl">
      <PageTitle
        title={definition.label}
        tagline={`${clientLabel} - ${completed.answered} of ${completed.total} answered${
          completed.updatedAt
            ? ` · last saved ${new Date(completed.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}`
            : ""
        }`}
        actions={
          <span className="flex items-center gap-3 print:hidden">
            <Link href={`/admin/forms/${encodeURIComponent(key)}`} className="text-sm underline text-gray-500 hover:text-gray-900">
              ← Everyone
            </Link>
            <FormExportButtons formKey={key} clientId={cid} />
            <PrintButton />
          </span>
        }
      />

      <div className="space-y-4">
        {completed.sections.map((section, si) => (
          <section key={si} className="bg-white rounded-xl border border-gray-200 overflow-hidden break-inside-avoid">
            <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-200">
              <h2 className="serif text-base font-semibold text-gray-900">{section.title}</h2>
              {section.description && <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>}
            </div>
            <dl className="divide-y divide-gray-100">
              {section.fields.map((f) => (
                <div key={f.fieldKey} className="px-5 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm text-gray-500">{f.label}</dt>
                  <dd className={`text-sm sm:col-span-2 ${f.answered ? "text-gray-900" : "text-gray-300 italic"}`}>
                    {f.answered ? f.value : "not answered"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  )
}
