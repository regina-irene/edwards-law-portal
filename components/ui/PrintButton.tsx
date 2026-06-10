"use client"

// Opens the browser's print dialog. The layout chrome (sidebar, top strip,
// buttons) is hidden in print via print:hidden classes, so only the page
// content prints.
export default function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="text-sm font-semibold px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors print:hidden"
      style={{ color: "#1b2d45", borderColor: "#1b2d45", background: "#fff" }}
    >
      🖨️ {label}
    </button>
  )
}
