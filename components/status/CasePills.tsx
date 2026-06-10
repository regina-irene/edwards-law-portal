// components/status/CasePills.tsx — case facts pulled from the Status board,
// shown as labeled chips colored exactly like the Airtable board.
// (Interim UI — Regina is choosing a replacement layout from mockups.)
import type { CaseStatusInfo } from "@/lib/airtable"
import { stageColor, caseTypeColor, countyColor, judgeColor, type ChipColor } from "@/lib/airtable-colors"

// Date-only strings ("2026-03-03") — anchor to local midnight so the day never shifts.
function shortDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// "4 - Post Answer Dis." → "Post Answer Dis." (internal ordering prefix)
export function prettyStage(name: string): string {
  return name.replace(/^\d+\s*-\s*/, "").trim()
}

const NEUTRAL: ChipColor = { bg: "rgba(255,255,255,0.9)", text: "#1b2d45" }

function Pill({ label, value, color = NEUTRAL }: { label: string; value: string; color?: ChipColor }) {
  return (
    <span
      className="px-3.5 py-1.5 rounded-full text-sm shadow-sm border border-black/5"
      style={{ background: color.bg, color: color.text }}
    >
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

  const pills: { label: string; value: string; color?: ChipColor }[] = []
  if (info.county) pills.push({ label: "County", value: info.county.replace(/^\*/, ""), color: countyColor(info.county) })
  if (info.judge) pills.push({ label: "Judge", value: info.judge, color: judgeColor(info.judge) })
  for (const t of info.caseTypes) pills.push({ label: "Case Type", value: t, color: caseTypeColor(t) })
  for (const s of info.stages) pills.push({ label: "Stage", value: prettyStage(s), color: stageColor(s) })
  if (info.caseFiled) pills.push({ label: "Filed", value: shortDate(info.caseFiled) })
  if (info.dateOfService) pills.push({ label: "Served", value: shortDate(info.dateOfService) })
  if (info.caseFiled || info.dateOfService) pills.push({ label: "Answer Filed", value: answerFiled })

  if (pills.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {pills.map((p, i) => (
        <Pill key={`${p.label}-${i}`} label={p.label} value={p.value} color={p.color} />
      ))}
    </div>
  )
}
