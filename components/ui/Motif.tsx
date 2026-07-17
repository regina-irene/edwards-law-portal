// components/ui/Motif.tsx — signature line-art watermark (Thistle-style touch,
// our own artwork). Sits in the bottom-right corner, faint, never interactive.
// Variants: magnolia branch, Cherokee rose, scales of justice.
// After Regina picks on /admin/motif, set MOTIF_DEFAULT to her choice.

export type MotifVariant = "magnolia" | "rose" | "scales"
export const MOTIF_DEFAULT: MotifVariant = "magnolia"

const NAVY = "#1b2d45"

function Petals({ cx, cy, r, count, rotate = 0 }: { cx: number; cy: number; r: number; count: number; rotate?: number }) {
  const petals = []
  for (let i = 0; i < count; i++) {
    const a = rotate + (i * 360) / count
    petals.push(
      <ellipse key={i} cx={cx} cy={cy - r} rx={r * 0.42} ry={r * 0.85}
        transform={`rotate(${a} ${cx} ${cy})`} fill="none" stroke={NAVY} strokeWidth="1.4" />
    )
  }
  return <>{petals}</>
}

function MagnoliaArt() {
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" fill="none">
      {/* branch */}
      <path d="M14 186 C 60 150, 92 118, 132 66" stroke={NAVY} strokeWidth="2" strokeLinecap="round" />
      <path d="M74 132 C 92 128, 106 132, 116 142" stroke={NAVY} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M104 96 C 88 90, 78 92, 68 84" stroke={NAVY} strokeWidth="1.6" strokeLinecap="round" />
      {/* leaves */}
      <path d="M116 142 q 16 2 22 16 q -18 2 -22 -16 Z" stroke={NAVY} strokeWidth="1.4" />
      <path d="M68 84 q -16 -6 -18 -22 q 16 4 18 22 Z" stroke={NAVY} strokeWidth="1.4" />
      {/* bloom */}
      <Petals cx={144} cy={52} r={26} count={6} rotate={12} />
      <circle cx={144} cy={52} r={6} stroke={NAVY} strokeWidth="1.4" />
      {/* bud */}
      <Petals cx={96} cy={124} r={11} count={5} rotate={30} />
    </svg>
  )
}

function RoseArt() {
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" fill="none">
      <Petals cx={100} cy={100} r={54} count={5} rotate={0} />
      <Petals cx={100} cy={100} r={32} count={5} rotate={36} />
      <circle cx={100} cy={100} r={12} stroke={NAVY} strokeWidth="1.4" />
      <circle cx={100} cy={100} r={5} stroke={NAVY} strokeWidth="1.2" />
    </svg>
  )
}

function ScalesArt() {
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" fill="none" stroke={NAVY}>
      <line x1="100" y1="28" x2="100" y2="168" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="52" x2="160" y2="52" strokeWidth="2" strokeLinecap="round" />
      <circle cx="100" cy="24" r="6" strokeWidth="1.6" />
      <line x1="70" y1="176" x2="130" y2="176" strokeWidth="2" strokeLinecap="round" />
      {/* left pan */}
      <line x1="40" y1="52" x2="24" y2="96" strokeWidth="1.4" />
      <line x1="40" y1="52" x2="56" y2="96" strokeWidth="1.4" />
      <path d="M16 96 H 64 A 24 24 0 0 1 16 96 Z" strokeWidth="1.6" />
      {/* right pan */}
      <line x1="160" y1="52" x2="144" y2="96" strokeWidth="1.4" />
      <line x1="160" y1="52" x2="176" y2="96" strokeWidth="1.4" />
      <path d="M136 96 H 184 A 24 24 0 0 1 136 96 Z" strokeWidth="1.6" />
    </svg>
  )
}

const ART: Record<MotifVariant, () => React.ReactElement> = {
  magnolia: MagnoliaArt,
  rose: RoseArt,
  scales: ScalesArt,
}

interface MotifProps {
  variant?: MotifVariant
  size?: number      // px
  opacity?: number   // 0..1
  fixed?: boolean    // corner watermark (true) vs inline block (false, preview)
}

export default function Motif({ variant = MOTIF_DEFAULT, size = 220, opacity = 0.07, fixed = true }: MotifProps) {
  const Art = ART[variant]
  return (
    <div
      aria-hidden="true"
      className={`${fixed ? "fixed bottom-2 right-2 z-0" : ""} pointer-events-none select-none print:hidden`}
      style={{ width: size, height: size, opacity }}
    >
      <Art />
    </div>
  )
}
