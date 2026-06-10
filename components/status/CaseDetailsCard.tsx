// components/status/CaseDetailsCard.tsx — "Case Details" card below the Status
// of Your Case write-up. Three columns (Regina's layout): Stage on the left,
// the case dates in the middle in date order (oldest first), and the
// court/case facts on the right. Chips use the Airtable board colors.
import type { CaseStatusInfo } from "@/lib/airtable"
import {
  stageColor,
  caseTypeColor,
  countyColor,
  judgeColor,
  plfDftColor,
  type ChipColor,
} from "@/lib/airtable-colors"

// Date-only strings ("2026-03-03") — anchor to local midnight so the day never shifts.
function shortDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// "4 - Post Answer Dis." → "Post Answer Dis." (internal ordering prefix)
function prettyStage(name: string): string {
  return name.replace(/^\d+\s*-\s*/, "").trim()
}

function Chip({ value, color }: { value: string; color: ChipColor }) {
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-sm font-semibold border border-black/5"
      style={{ background: color.bg, color: color.text }}
    >
      {value}
    </span>
  )
}

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs uppercase tracking-wide mb-2 font-semibold" style={{ color: "#8a7240" }}>{children}</h3>
}

export default function CaseDetailsCard({ info }: { info: CaseStatusInfo }) {
  // middle column: every dated event, oldest first
  const dates: { label: string; date: string }[] = []
  if (info.caseFiled) dates.push({ label: "Case Filed", date: info.caseFiled })
  if (info.dateOfService) dates.push({ label: "Date of Service", date: info.dateOfService })
  if (info.dateAnswerFiled) dates.push({ label: "Answer Filed", date: info.dateAnswerFiled })
  dates.sort((a, b) => a.date.localeCompare(b.date))

  // yes/no facts without their own date ride along under the date list
  const checks: { label: string; value: string; done: boolean }[] = [
    { label: "Service Perfected", value: info.servicePerfected ? "Yes" : "Not yet", done: info.servicePerfected },
  ]
  if (!info.dateAnswerFiled) {
    checks.push({ label: "Answer Filed", value: info.answerFiled ? "Yes" : "Not yet", done: info.answerFiled })
  }

  return (
    <div>
      {/* manila case-file folder with tab (Regina's pick from the 8 mockups) */}
      <div
        className="inline-block rounded-t-lg px-5 py-1.5 text-xs font-bold uppercase tracking-wider border border-b-0 shadow-sm"
        style={{ background: "#F3E3BF", borderColor: "#E0CD9E", color: "#6b5328" }}
      >
        📁 Case File
      </div>
      <div
        className="rounded-b-lg rounded-tr-lg border p-6 shadow-sm"
        style={{ background: "#FAF0D7", borderColor: "#E0CD9E" }}
      >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Left: stage */}
        <div>
          <ColumnTitle>Stage</ColumnTitle>
          {info.stages.length > 0 ? (
            <div className="flex flex-col items-start gap-1.5">
              {info.stages.map((s) => <Chip key={s} value={prettyStage(s)} color={stageColor(s)} />)}
            </div>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>

        {/* Middle: dates, oldest first */}
        <div>
          <ColumnTitle>Key Dates</ColumnTitle>
          {dates.length > 0 ? (
            <ul>
              {dates.map((d) => (
                <li key={d.label} className="flex items-baseline gap-2 py-1">
                  <span className="w-2 h-2 rounded-full shrink-0 self-center" style={{ background: "#1b2d45" }} />
                  <span className="text-sm text-gray-500 flex-1">{d.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{shortDate(d.date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No dates yet</p>
          )}
          {checks.map((c) => (
            <p key={c.label} className="flex items-baseline gap-2 py-1">
              <span className={`w-2 h-2 rounded-full shrink-0 self-center ${c.done ? "bg-green-600" : "bg-gray-300"}`} />
              <span className="text-sm text-gray-500 flex-1">{c.label}</span>
              <span className={`text-sm font-semibold ${c.done ? "text-green-700" : "text-gray-500"}`}>{c.value}</span>
            </p>
          ))}
        </div>

        {/* Right: court + case facts */}
        <div>
          <ColumnTitle>Case Info</ColumnTitle>
          <div className="space-y-2">
            {info.county && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-16 shrink-0">County</span>
                <Chip value={info.county.replace(/^\*/, "")} color={countyColor(info.county)} />
              </div>
            )}
            {info.judge && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-16 shrink-0">Judge</span>
                <Chip value={info.judge} color={judgeColor(info.judge)} />
              </div>
            )}
            {info.caseTypes.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500 w-16 shrink-0">Type</span>
                {info.caseTypes.map((t) => <Chip key={t} value={t} color={caseTypeColor(t)} />)}
              </div>
            )}
            {info.plfDft && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-16 shrink-0">You are</span>
                <Chip value={info.plfDft} color={plfDftColor(info.plfDft)} />
              </div>
            )}
          </div>
        </div>

      </div>
      </div>
    </div>
  )
}
