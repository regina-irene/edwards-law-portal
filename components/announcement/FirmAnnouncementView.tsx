// components/announcement/FirmAnnouncementView.tsx — display-only firm
// announcement strip for the CLIENT portal. Translucent so it blends with the
// fixed navy/cream background. Kept out of FirmAnnouncementBanner.tsx (and free
// of "use client") so client pages don't ship the admin editor + save logic.
import { RichTextView } from "@/components/ui/RichTextView"

// Display-only version for the CLIENT portal. Translucent so it blends with
// the fixed navy/cream background.
export function FirmAnnouncementView({ html }: { html: string }) {
  if (!html) return null
  return (
    <div
      className="border-b px-4 sm:px-6 py-2.5 print:hidden backdrop-blur-md"
      style={{
        background: "rgba(255,255,255,0.85)",
        borderColor: "rgba(0,0,0,0.08)",
      }}
    >
      <div className="flex items-center justify-center gap-3 text-center">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-base">📢</span>
          <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Firm Announcements</span>
        </div>
        <span className="shrink-0 text-amber-300">|</span>
        <div className="min-w-0 text-sm text-center [&_div]:!text-center [&_p]:!text-center">
          <RichTextView html={html} className="!text-[#3d3426]" />
        </div>
      </div>
    </div>
  )
}
