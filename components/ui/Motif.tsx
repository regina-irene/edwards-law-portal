// components/ui/Motif.tsx — signature watermark: the firm logo, very faint,
// in the bottom-right corner of every page. Regina picked her logo over drawn
// line art (2026-07-17); the SVG variants + /admin/motif picker were removed.

interface MotifProps {
  size?: number      // px
  opacity?: number   // 0..1
  fixed?: boolean    // corner watermark (true) vs inline block (false)
}

export default function Motif({ size = 220, opacity = 0.08, fixed = true }: MotifProps) {
  return (
    <div
      aria-hidden="true"
      className={`${fixed ? "fixed bottom-2 right-2 z-0" : ""} pointer-events-none select-none print:hidden`}
      style={{ width: size, height: size, opacity }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/efl-logo.png" alt="" className="w-full h-full object-contain" style={{ filter: "grayscale(100%)" }} />
    </div>
  )
}
