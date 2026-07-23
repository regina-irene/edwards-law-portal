// components/ui/SchemeDecor.tsx — festive background layer for seasonal
// color schemes: ~6 large, faint emojis floating over the page background.
// Sits under the content (main is relative z-10); hidden when printing.
import type { ColorScheme } from "@/lib/color-schemes"

const SPOTS: { top: string; left: string; size: number }[] = [
  { top: "12%", left: "22%", size: 44 },
  { top: "28%", left: "58%", size: 36 },
  { top: "46%", left: "34%", size: 48 },
  { top: "60%", left: "72%", size: 40 },
  { top: "74%", left: "28%", size: 36 },
  { top: "86%", left: "56%", size: 44 },
]

export default function SchemeDecor({ scheme }: { scheme: ColorScheme }) {
  if (!scheme.seasonal || scheme.watermark.length === 0) return null
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none select-none print:hidden">
      {SPOTS.map((spot, i) => (
        <span
          key={i}
          className="absolute"
          style={{ top: spot.top, left: spot.left, fontSize: spot.size, opacity: 0.15 }}
        >
          {scheme.watermark[i % scheme.watermark.length]}
        </span>
      ))}
    </div>
  )
}
