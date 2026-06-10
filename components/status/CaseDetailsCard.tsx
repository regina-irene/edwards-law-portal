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
  filedByColor,
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

export interface LatestPleading {
  title: string
  date: string | null
  filedBy: string
  link: string
}

export default function CaseDetailsCard({ info, latestPleading }: { info: CaseStatusInfo; latestPleading?: LatestPleading | null }) {
  // middle column, in Regina's fixed order
  const rows: { label: string; value: string; done: boolean }[] = [
    { label: "Case Filed", value: info.caseFiled ? shortDate(info.caseFiled) : "—", done: Boolean(info.caseFiled) },
    { label: "Service Perfected", value: info.servicePerfected ? "Yes" : "Not yet", done: info.servicePerfected },
    { label: "Date of Service", value: info.dateOfService ? shortDate(info.dateOfService) : "—", done: Boolean(info.dateOfService) },
    {
      label: "Answer Filed",
      value: info.dateAnswerFiled ? shortDate(info.dateAnswerFiled) : info.answerFiled ? "Yes" : "Not yet",
      done: Boolean(info.dateAnswerFiled) || info.answerFiled,
    },
  ]
  if (latestPleading?.date) {
    rows.push({ label: "Latest Pleading", value: shortDate(latestPleading.date), done: true })
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
      <div className="grid grid-cols-1 md:grid-cols-[1fr_0.85fr_1.25fr] gap-6">

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

        {/* Middle: key dates in fixed order */}
        <div>
          <ColumnTitle>Key Dates</ColumnTitle>
          <ul>
            {rows.map((r) => (
              <li key={r.label} className="flex items-baseline gap-2 py-1">
                <span className={`w-2 h-2 rounded-full shrink-0 self-center ${r.done ? "bg-green-600" : "bg-gray-300"}`} />
                <span className="text-sm text-gray-500 flex-1">{r.label}</span>
                <span className={`text-sm font-semibold whitespace-nowrap ${r.done ? "text-gray-900" : "text-gray-500"}`}>{r.value}</span>
              </li>
            ))}
          </ul>
          {latestPleading?.date && (
            <div className="mt-1 pl-4 space-y-1">
              {latestPleading.link ? (
                <a
                  href={latestPleading.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs font-medium underline hover:opacity-75 break-words"
                  style={{ color: "#1b2d45" }}
                  title={latestPleading.title}
                >
                  {latestPleading.title}
                </a>
              ) : (
                <p className="text-xs text-gray-500 italic break-words" title={latestPleading.title}>{latestPleading.title}</p>
              )}
              {latestPleading.filedBy && (
                <span
                  className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border border-black/5"
                  style={{ background: filedByColor(latestPleading.filedBy).bg, color: filedByColor(latestPleading.filedBy).text }}
                >
                  Filed by {latestPleading.filedBy.replace(/\s+/g, " ").trim()}
                </span>
              )}
            </div>
          )}
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
