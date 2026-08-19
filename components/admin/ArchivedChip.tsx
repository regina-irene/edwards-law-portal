// components/admin/ArchivedChip.tsx - the muted marker every admin list puts on
// a closed case, so an archived client can never be mistaken for a live one.
//
// Deliberately plain: no hooks, no imports, no "use client", so the same
// component renders inside a server page and inside a client list alike. The
// wording ("closed 12 days ago" / "access ended") is worked out on the server
// by lib/admin-archive and handed in as `note`.
export default function ArchivedChip({ note, className = "" }: { note?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 align-middle ${className}`}>
      <span
        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500 border border-gray-200"
        title="Archived on the Clients board - a former or closed case"
      >
        Archived
      </span>
      {note && <span className="text-[11px] text-gray-400">{note}</span>}
    </span>
  )
}
