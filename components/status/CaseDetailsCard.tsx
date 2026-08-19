// components/status/CaseDetailsCard.tsx — "Case Details" card below the Status
// of Your Case write-up. Three columns (Regina's layout): Stage on the left,
// the case dates in the middle in date order (oldest first), and the
// court/case facts on the right. Chips use the Airtable board colors.
import type { CaseStatusInfo } from "@/lib/airtable"
import { plainStage } from "@/lib/case-status"
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

// Stage chips read as plain English ("Gathering information from both sides"),
// never the board's internal shorthand ("4 - Post Answer Dis."). See
// STAGE_PLAIN in lib/case-status.ts. `soft` just lets those longer labels wrap
// without the pill looking broken.
function Chip({ value, color, soft = false }: { value: string; color: ChipColor; soft?: boolean }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 text-sm font-semibold border border-black/5 ${soft ? "rounded-2xl leading-snug" : "rounded-full"}`}
      style={{ background: color.bg, color: color.text }}
    >
      {value}
    </span>
  )
}

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[13px] uppercase tracking-wider font-bold mb-3 pb-1.5 border-b-2"
      style={{ color: "#5b451c", borderColor: "#E0CD9E" }}
    >
      {children}
    </h3>
  )
}

// soft divider between sections: vertical on big screens, horizontal when stacked
const COL_DIVIDER = "border-[#E8D9B5] border-t pt-4 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-5"

export interface RecentFiling {
  title: string
  date: string | null
  filedBy: string
  link: string
}

export interface NextCourtDate {
  title: string
  start: string // ISO datetime
  allDay?: boolean
}

interface CaseDetailsCardProps {
  info: CaseStatusInfo
  recentFilings?: RecentFiling[]
  nextCourt?: NextCourtDate | null
}

export default function CaseDetailsCard({ info, recentFilings = [], nextCourt }: CaseDetailsCardProps) {
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
        className="rounded-b-lg rounded-tr-lg border p-6 shadow-sm keep-ink"
        style={{ background: "#FAF0D7", borderColor: "#E0CD9E" }}
      >
      {/* Equal-width columns: 1 per row on phones, 2 on tablets, all side-by-side on desktop */}
      <div className={`grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 ${nextCourt ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>

        {/* Left: stage */}
        <div>
          <ColumnTitle>Stage</ColumnTitle>
          {info.stages.length > 0 ? (
            <div className="flex flex-col items-start gap-1.5">
              {info.stages.map((s) => <Chip key={s} value={plainStage(s)} color={stageColor(s)} soft />)}
            </div>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>

        {/* Middle: key dates in fixed order */}
        <div className={`${COL_DIVIDER} sm:border-t-0 sm:pt-0 sm:border-l sm:pl-5`}>
          <ColumnTitle>Key Dates</ColumnTitle>
          <ul>
            {rows.map((r) => (
              <li key={r.label} className="flex items-baseline gap-2 py-1">
                <span className={`w-2 h-2 rounded-full shrink-0 self-center ${r.done ? "bg-green-600" : "bg-gray-300"}`} />
                <span className="text-sm text-gray-500 w-28 shrink-0">{r.label}</span>
                <span className={`text-sm font-semibold whitespace-nowrap ${r.done ? "text-gray-900" : "text-gray-500"}`}>{r.value}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: court + case facts */}
        <div className={COL_DIVIDER}>
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

          {recentFilings.length > 0 && (
            <div className="mt-5">
              <ColumnTitle>Recent Filings</ColumnTitle>
              <ul className="space-y-2">
                {recentFilings.slice(0, 3).map((f, i) => (
                  <li key={i} className="text-xs">
                    {f.link ? (
                      <a
                        href={f.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block font-medium underline hover:opacity-75 break-words"
                        style={{ color: "#1b2d45" }}
                        title={f.title}
                      >
                        {f.title}
                      </a>
                    ) : (
                      <span className="block font-medium text-gray-700 break-words">{f.title}</span>
                    )}
                    <span className="text-gray-500">
                      {f.date ? shortDate(f.date) : ""}
                      {f.filedBy && (
                        <span
                          className="inline-block ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-black/5"
                          style={{ background: filedByColor(f.filedBy).bg, color: filedByColor(f.filedBy).text }}
                        >
                          Filed by {f.filedBy.replace(/\s+/g, " ").trim()}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 4th column: next court date — full title, never cut off */}
        {nextCourt && (
          <div className={`${COL_DIVIDER} sm:border-t-0 sm:pt-0 sm:border-l sm:pl-5`}>
            <ColumnTitle>Next Important Calendar Date</ColumnTitle>
            <p className="text-lg font-bold" style={{ color: "#1b2d45" }}>
              {new Date(nextCourt.start).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
            {!nextCourt.allDay && (
              <p className="text-sm font-semibold text-gray-700">
                {new Date(nextCourt.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </p>
            )}
            <p className="text-sm text-gray-600 mt-1.5 break-words">{nextCourt.title}</p>
          </div>
        )}

      </div>
      </div>
    </div>
  )
}
