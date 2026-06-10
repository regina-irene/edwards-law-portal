// components/status/CasePills.tsx — case facts pulled from the Status board,
// shown as labeled pills on the Case Status / Invoicing page.
import type { CaseStatusInfo } from "@/lib/airtable"

// Date-only strings ("2026-03-03") — anchor to local midnight so the day never shifts.
function shortDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function Pill({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  if (accent) {
    return (
      <span className="px-3.5 py-1.5 rounded-full text-sm font-semibold text-white shadow-sm" style={{ background: "#1b2d45" }}>
        <span className="opacity-70 font-medium">{label} · </span>
        {value}
      </span>
    )
  }
  return (
    <span className="px-3.5 py-1.5 rounded-full text-sm bg-white/90 border shadow-sm" style={{ borderColor: "#9fd3e3", color: "#1b2d45" }}>
      <span className="text-xs uppercase tracking-wide opacity-60">{label} </span>
      <span className="font-semibold">{value}</span>
    </span>
  )
}

export default function CasePills({ info }: { info: CaseStatusInfo }) {
  const answerFiled = info.dateAnswerFiled
    ? shortDate(info.dateAnswerFiled)
    : info.answerFiled
      ? "Yes"
      : "Not yet"

  const pills: { label: string; value: string; accent?: boolean }[] = []
  if (info.county) pills.push({ label: "County", value: info.county })
  if (info.judge) pills.push({ label: "Judge", value: info.judge })
  for (const t of info.caseTypes) pills.push({ label: "Case Type", value: t })
  for (const s of info.stages) pills.push({ label: "Stage", value: s, accent: true })
  if (info.caseFiled) pills.push({ label: "Filed", value: shortDate(info.caseFiled) })
  if (info.dateOfService) pills.push({ label: "Served", value: shortDate(info.dateOfService) })
  if (info.caseFiled || info.dateOfService) pills.push({ label: "Answer Filed", value: answerFiled })

  if (pills.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {pills.map((p, i) => (
        <Pill key={`${p.label}-${i}`} label={p.label} value={p.value} accent={p.accent} />
      ))}
    </div>
  )
}
