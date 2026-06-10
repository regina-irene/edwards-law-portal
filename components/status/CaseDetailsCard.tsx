// components/status/CaseDetailsCard.tsx — "Case Details" card shown beside the
// Status of Your Case write-up. Labels left, values right; select values are
// chips colored exactly like the Airtable Status board.
import type { CaseStatusInfo } from "@/lib/airtable"
import { stageColor, caseTypeColor, countyColor, judgeColor, type ChipColor } from "@/lib/airtable-colors"

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <td className="text-sm text-gray-500 py-1.5 pr-4 align-top whitespace-nowrap">{label}</td>
      <td className="py-1.5 space-x-1 space-y-1">{children}</td>
    </tr>
  )
}

export default function CaseDetailsCard({ info }: { info: CaseStatusInfo }) {
  const answerFiled = info.dateAnswerFiled
    ? shortDate(info.dateAnswerFiled)
    : info.answerFiled
      ? "Yes"
      : "Not yet"

  const hasDates = Boolean(info.caseFiled || info.dateOfService)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xs uppercase tracking-wide font-semibold mb-3" style={{ color: "#1b2d45" }}>Case Details</h2>
      <table className="w-full">
        <tbody>
          {info.county && (
            <Row label="County"><Chip value={info.county.replace(/^\*/, "")} color={countyColor(info.county)} /></Row>
          )}
          {info.judge && (
            <Row label="Judge"><Chip value={info.judge} color={judgeColor(info.judge)} /></Row>
          )}
          {info.caseTypes.length > 0 && (
            <Row label="Case Type">
              {info.caseTypes.map((t) => <Chip key={t} value={t} color={caseTypeColor(t)} />)}
            </Row>
          )}
          {info.stages.length > 0 && (
            <Row label="Stage">
              {info.stages.map((s) => <Chip key={s} value={prettyStage(s)} color={stageColor(s)} />)}
            </Row>
          )}
          {info.caseFiled && (
            <Row label="Filed"><span className="text-sm font-semibold text-gray-900">{shortDate(info.caseFiled)}</span></Row>
          )}
          {info.dateOfService && (
            <Row label="Served"><span className="text-sm font-semibold text-gray-900">{shortDate(info.dateOfService)}</span></Row>
          )}
          {hasDates && (
            <Row label="Answer Filed"><span className="text-sm font-semibold text-gray-900">{answerFiled}</span></Row>
          )}
        </tbody>
      </table>
    </div>
  )
}
