// components/ui/SchemeDecor.tsx — festive background layer for seasonal color
// schemes. Turned up considerably on 2026-08-18: ~20 emojis instead of 6, a
// wider size range, tilts, and roughly double the opacity, so a holiday look
// actually reads as a holiday. Still sits under the content (main is
// relative z-10), still non-interactive, still hidden when printing.
import type { ColorScheme } from "@/lib/color-schemes"

interface Spot {
  top: string
  left: string
  size: number
  rotate: number
  opacity: number
}

// Hand-placed rather than random so the layout is stable between server and
// client renders. Left edge starts past the 96px sidebar; the bottom-right
// corner is left clear for the firm logo watermark.
const SPOTS: Spot[] = [
  { top: "4%", left: "14%", size: 46, rotate: -12, opacity: 0.3 },
  { top: "9%", left: "39%", size: 30, rotate: 8, opacity: 0.24 },
  { top: "6%", left: "63%", size: 62, rotate: 15, opacity: 0.28 },
  { top: "13%", left: "85%", size: 38, rotate: -6, opacity: 0.26 },
  { top: "20%", left: "25%", size: 72, rotate: 10, opacity: 0.3 },
  { top: "24%", left: "52%", size: 34, rotate: -14, opacity: 0.22 },
  { top: "19%", left: "74%", size: 44, rotate: 6, opacity: 0.27 },
  { top: "33%", left: "16%", size: 36, rotate: 12, opacity: 0.25 },
  { top: "37%", left: "43%", size: 84, rotate: -8, opacity: 0.29 },
  { top: "31%", left: "67%", size: 40, rotate: 18, opacity: 0.24 },
  { top: "41%", left: "88%", size: 54, rotate: -10, opacity: 0.28 },
  { top: "50%", left: "22%", size: 58, rotate: 7, opacity: 0.3 },
  { top: "55%", left: "58%", size: 32, rotate: -16, opacity: 0.23 },
  { top: "49%", left: "78%", size: 46, rotate: 11, opacity: 0.26 },
  { top: "64%", left: "13%", size: 42, rotate: -9, opacity: 0.27 },
  { top: "68%", left: "38%", size: 66, rotate: 14, opacity: 0.29 },
  { top: "62%", left: "70%", size: 34, rotate: -5, opacity: 0.22 },
  { top: "79%", left: "26%", size: 50, rotate: 9, opacity: 0.28 },
  { top: "84%", left: "55%", size: 38, rotate: -13, opacity: 0.25 },
  { top: "76%", left: "82%", size: 44, rotate: 16, opacity: 0.24 },
  { top: "91%", left: "17%", size: 34, rotate: -7, opacity: 0.23 },
  { top: "93%", left: "44%", size: 56, rotate: 12, opacity: 0.27 },
]

export default function SchemeDecor({ scheme }: { scheme: ColorScheme }) {
  if (!scheme.seasonal || scheme.watermark.length === 0) return null
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none select-none print:hidden overflow-hidden">
      {SPOTS.map((spot, i) => (
        <span
          key={i}
          className="absolute leading-none"
          style={{
            top: spot.top,
            left: spot.left,
            fontSize: spot.size,
            opacity: spot.opacity,
            transform: `rotate(${spot.rotate}deg)`,
          }}
        >
          {scheme.watermark[i % scheme.watermark.length]}
        </span>
      ))}
    </div>
  )
}
