// components/pleadings/PleadingsList.tsx — docket-style list of the client's
// pleadings (from the Pleadings table in their Airtable base), replacing the
// raw Airtable embed.
import type { PleadingDoc } from "@/lib/pleadings"
import { filedByColor } from "@/lib/airtable-colors"

function shortDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  pdf: { bg: "#FFDCE5", text: "#BA1E45" },
  doc: { bg: "#CFDFFF", text: "#2750AE" },
  docx: { bg: "#CFDFFF", text: "#2750AE" },
  jpg: { bg: "#D1F7C4", text: "#338A17" },
  jpeg: { bg: "#D1F7C4", text: "#338A17" },
  png: { bg: "#D1F7C4", text: "#338A17" },
}

export default function PleadingsList({ docs }: { docs: PleadingDoc[] }) {
  if (docs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-sm text-gray-500">No pleadings on file yet. Documents will appear here as they are filed.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
      {docs.map((d) => {
        const dateLabel = d.filedOn ? shortDate(d.filedOn) : d.created ? shortDate(d.created.slice(0, 10)) : null
        const type = d.fileType.toLowerCase()
        const typeStyle = TYPE_STYLE[type] ?? { bg: "#EEEEEE", text: "#333333" }
        return (
          <div key={d.id} className="flex items-center gap-4 px-5 py-3.5">
            <div className="w-24 shrink-0 text-right">
              {dateLabel && <span className="text-xs font-semibold text-gray-500">{dateLabel}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 break-words">{d.title}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {d.filedBy && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full border border-black/5"
                    style={{ background: filedByColor(d.filedBy).bg, color: filedByColor(d.filedBy).text }}
                  >
                    Filed by {d.filedBy.replace(/\s+/g, " ").trim()}
                  </span>
                )}
                {d.notes && <span className="text-xs text-gray-500 truncate">{d.notes}</span>}
              </div>
            </div>
            {type && (
              <span
                className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                style={{ background: typeStyle.bg, color: typeStyle.text }}
              >
                {type}
              </span>
            )}
            {d.link ? (
              <a
                href={d.link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-semibold px-4 py-1.5 rounded-lg text-white hover:opacity-90 transition-opacity"
                style={{ background: "#1b2d45" }}
              >
                View
              </a>
            ) : (
              <span className="shrink-0 text-xs text-gray-400">No link</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
