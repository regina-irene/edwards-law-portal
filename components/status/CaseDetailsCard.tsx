// components/status/CaseDetailsCard.tsx - "Case Details" card below the Status
// of Your Case write-up. Three columns (Regina's layout): Stage on the left,
// the case dates in the middle in date order (oldest first), and the
// court/case facts on the right. Chips use the Airtable board colors.
import type { CaseStatusInfo } from "@/lib/airtable"
// Type-only - nothing from lib reaches the browser through this import.
import type { ExtraField } from "@/lib/status-extra"
import { plainStage } from "@/lib/case-status"
import {
  stageColor,
  caseTypeColor,
  countyColor,
  judgeColor,
  plfDftColor,
  filedByColor,
  paymentStatusColor,
  type ChipColor,
} from "@/lib/airtable-colors"

// Date-only strings ("2026-03-03") - anchor to local midnight so the day never shifts.
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
  /**
   * Airtable field names this client is allowed to see (lib/status-fields).
   * Omitted means "everything below", which is what the card did before the
   * setting existed - so a page that doesn't pass it is unchanged.
   */
  visibleFields?: readonly string[]
  /** Extra board fields switched on for this client, already formatted. */
  extraFields?: ExtraField[]
}

export default function CaseDetailsCard({
  info,
  recentFilings = [],
  nextCourt,
  visibleFields,
  extraFields = [],
}: CaseDetailsCardProps) {
  const allowed = visibleFields ? new Set(visibleFields) : null
  // Field names are the board's own, two spaces in "Plf /  Dft" and all.
  const shows = (field: string): boolean => (allowed ? allowed.has(field) : true)

  // middle column, in Regina's fixed order
  const allRows: { label: string; value: string; done: boolean; field: string; alt?: string }[] = [
    { label: "Case Filed", value: info.caseFiled ? shortDate(info.caseFiled) : "-", done: Boolean(info.caseFiled), field: "Case Filed" },
    { label: "Service Perfected", value: info.servicePerfected ? "Yes" : "Not yet", done: info.servicePerfected, field: "Service Perfected?" },
    { label: "Date of Service", value: info.dateOfService ? shortDate(info.dateOfService) : "-", done: Boolean(info.dateOfService), field: "Date of Service" },
    {
      label: "Answer Filed",
      value: info.dateAnswerFiled ? shortDate(info.dateAnswerFiled) : info.answerFiled ? "Yes" : "Not yet",
      done: Boolean(info.dateAnswerFiled) || info.answerFiled,
      // One row, two board fields - it shows while either is switched on.
      field: "Answer Filed?",
      alt: "Date Answer Filed",
    },
  ]
  const rows = allRows.filter((r) => shows(r.field) || (r.alt !== undefined && shows(r.alt)))

  const showCounty = Boolean(info.county) && shows("County")
  const showJudge = Boolean(info.judge) && shows("Judge")
  const showCaseTypes = info.caseTypes.length > 0 && shows("Case Type")
  const showPlfDft = Boolean(info.plfDft) && shows("Plf /  Dft")
  const showPayment = Boolean(info.paymentStatus) && shows("Payment Status")

  const showKeyDates = rows.length > 0
  const showCaseInfo = showCounty || showJudge || showCaseTypes || showPlfDft || recentFilings.length > 0
  // Keep today's 2/3-column behaviour: nothing hidden means nothing moves.
  const columnCount = [showKeyDates, showCaseInfo, Boolean(nextCourt)].filter(Boolean).length

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
      {/* Stage sits across the top rather than owning a whole column of its own
          (2026-08-18). It is usually one chip, so a full column left three
          quarters of that space empty and squeezed everything else. */}
      {(shows("Case Stage") || showPayment) && (
      /* Label and chip sit on ONE line. Using the column heading here put a
         full-width rule under the word "Stage" with a lone chip stranded
         beneath it, which read as a broken column rather than a banner.
         Payment status rides along on the right of the same banner rather
         than sitting alone under the whole card. (2026-08-18) */
      <div
        className="mb-4 flex items-baseline gap-x-3 gap-y-2 flex-wrap border-b-2 pb-2"
        style={{ borderColor: "#E0CD9E" }}
      >
        {shows("Case Stage") && (
          <>
            <h3 className="text-[13px] uppercase tracking-wider font-bold shrink-0" style={{ color: "#5b451c" }}>
              Stage
            </h3>
            {info.stages.length > 0 ? (
              <div className="flex flex-wrap items-baseline gap-1.5">
                {info.stages.map((s) => <Chip key={s} value={plainStage(s)} color={stageColor(s)} soft />)}
              </div>
            ) : (
              <p className="text-sm text-gray-400">-</p>
            )}
          </>
        )}

        {showPayment && (
          <div className="flex items-baseline gap-2 ml-auto shrink-0">
            <h3 className="text-[13px] uppercase tracking-wider font-bold" style={{ color: "#5b451c" }}>
              Payment
            </h3>
            <Chip value={info.paymentStatus} color={paymentStatusColor(info.paymentStatus)} />
          </div>
        )}
      </div>
      )}

      {/* Equal-width columns: 1 per row on phones, 2 on tablets, side-by-side on desktop */}
      <div className={`grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 ${columnCount >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>

        {/* Key dates in fixed order */}
        {showKeyDates && (
        <div>
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
        )}

        {/* Court + case facts */}
        {showCaseInfo && (
        <div className={showKeyDates ? `${COL_DIVIDER} sm:border-t-0 sm:pt-0 sm:border-l sm:pl-5` : ""}>
          <ColumnTitle>Case Info</ColumnTitle>
          <div className="space-y-2">
            {showCounty && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-16 shrink-0">County</span>
                <Chip value={info.county.replace(/^\*/, "")} color={countyColor(info.county)} />
              </div>
            )}
            {showJudge && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-16 shrink-0">Judge</span>
                <Chip value={info.judge} color={judgeColor(info.judge)} />
              </div>
            )}
            {showCaseTypes && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500 w-16 shrink-0">Type</span>
                {info.caseTypes.map((t) => <Chip key={t} value={t} color={caseTypeColor(t)} />)}
              </div>
            )}
            {showPlfDft && (
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
        )}

        {/* Next court date - full title, never cut off */}
        {nextCourt && (
          <div className={showKeyDates || showCaseInfo ? COL_DIVIDER : ""}>
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

      {/* Extra board fields the firm has explicitly switched on for this client
          (Settings → Case Status fields, or the per-client override). Everything
          already drawn above is filtered out upstream, so nothing repeats, and
          this whole section disappears when nothing is switched on - which is
          the default for every field the portal didn't already show. */}
      {extraFields.length > 0 && (
        <div className="mt-5 pt-4 border-t" style={{ borderColor: "#E8D9B5" }}>
          <ColumnTitle>More Case Information</ColumnTitle>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
            {extraFields.map((f) => (
              <div key={f.name} className="flex items-baseline gap-2">
                <dt className="text-sm text-gray-500 shrink-0">{f.name}</dt>
                <dd className="text-sm font-semibold text-gray-900 break-words min-w-0">
                  {f.display.kind === "chips" ? (
                    <span className="flex flex-wrap gap-1.5">
                      {f.display.values.map((v, i) => (
                        <span
                          key={`${v}-${i}`}
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold border border-black/5"
                          style={{ background: "#F3E3BF", color: "#5b451c" }}
                        >
                          {v}
                        </span>
                      ))}
                    </span>
                  ) : (
                    f.display.text
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      </div>
    </div>
  )
}
