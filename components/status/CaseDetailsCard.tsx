// components/status/CaseDetailsCard.tsx — full-width "Case Details" card shown
// below the Status of Your Case write-up, fields in two columns. Select values
// are chips colored exactly like the Airtable Status board.
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

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-2 border-b border-gray-100">
      <span className="text-sm text-gray-500 w-32 shrink-0">{label}</span>
      <span className="space-x-1 space-y-1">{children}</span>
    </div>
  )
}

export default function CaseDetailsCard({ info }: { info: CaseStatusInfo }) {
  const answerFiled = info.dateAnswerFiled
    ? shortDate(info.dateAnswerFiled)
    : info.answerFiled
      ? "Yes"
      : "Not yet"

  const items: React.ReactNode[] = []
  if (info.county) {
    items.push(<Item key="county" label="County"><Chip value={info.county.replace(/^\*/, "")} color={countyColor(info.county)} /></Item>)
  }
  if (info.judge) {
    items.push(<Item key="judge" label="Judge"><Chip value={info.judge} color={judgeColor(info.judge)} /></Item>)
  }
  if (info.caseTypes.length > 0) {
    items.push(
      <Item key="type" label="Case Type">
        {info.caseTypes.map((t) => <Chip key={t} value={t} color={caseTypeColor(t)} />)}
      </Item>
    )
  }
  if (info.stages.length > 0) {
    items.push(
      <Item key="stage" label="Stage">
        {info.stages.map((s) => <Chip key={s} value={prettyStage(s)} color={stageColor(s)} />)}
      </Item>
    )
  }
  if (info.plfDft) {
    items.push(<Item key="plfdft" label="Plf / Dft"><Chip value={info.plfDft} color={plfDftColor(info.plfDft)} /></Item>)
  }
  if (info.caseFiled) {
    items.push(<Item key="filed" label="Case Filed"><span className="text-sm font-semibold text-gray-900">{shortDate(info.caseFiled)}</span></Item>)
  }
  items.push(
    <Item key="perfected" label="Service Perfected">
      <span className={`text-sm font-semibold ${info.servicePerfected ? "text-green-700" : "text-gray-900"}`}>
        {info.servicePerfected ? "Yes" : "Not yet"}
      </span>
    </Item>
  )
  if (info.dateOfService) {
    items.push(<Item key="served" label="Date of Service"><span className="text-sm font-semibold text-gray-900">{shortDate(info.dateOfService)}</span></Item>)
  }
  items.push(
    <Item key="answer" label="Answer Filed">
      <span className="text-sm font-semibold text-gray-900">{answerFiled}</span>
    </Item>
  )

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xs uppercase tracking-wide font-semibold mb-3" style={{ color: "#1b2d45" }}>Case Details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">{items}</div>
    </div>
  )
}
