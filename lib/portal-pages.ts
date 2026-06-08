import { sql } from "@/lib/db"

// Built-in portal pages (fixed routes) with their nav labels, in default order.
export const BUILTIN_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "document-requests": "Document Requests",
  pleadings: "Pleadings",
  discovery: "Discovery",
  status: "Case Status",
  tasks: "Tasks",
  calendar: "Calendar",
  messages: "Messages",
  chat: "Chat",
}
export const BUILTIN_PAGE_KEYS = Object.keys(BUILTIN_LABELS)

export interface NavPage {
  key: string
  label: string
  href: string
  custom: boolean
}

export interface CustomPage {
  slug: string
  title: string
  position: number
}

export function slugify(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)
}

export async function getCustomPages(): Promise<CustomPage[]> {
  try {
    const r = await sql`SELECT slug, title, position FROM custom_pages ORDER BY position ASC, created_at ASC`
    return r.rows as CustomPage[]
  } catch {
    return []
  }
}

// All pages (built-in + custom), unfiltered — used by admin editors.
export async function getAllPages(): Promise<NavPage[]> {
  const custom = await getCustomPages()
  const builtins: NavPage[] = BUILTIN_PAGE_KEYS.map((k) => ({ key: k, label: BUILTIN_LABELS[k], href: `/${k}`, custom: false }))
  const customNav: NavPage[] = custom.map((c) => ({ key: c.slug, label: c.title, href: `/p/${c.slug}`, custom: true }))
  return [...builtins, ...customNav]
}

async function getNavOrder(): Promise<string[] | null> {
  try {
    const r = await sql`SELECT pages FROM nav_order LIMIT 1`
    return (r.rows[0]?.pages as string[]) ?? null
  } catch {
    return null
  }
}

async function loadPrefs(clientId: string): Promise<Map<string, boolean>> {
  try {
    const r = await sql`SELECT page_key, hidden FROM client_page_prefs WHERE client_id = ${clientId}`
    return new Map(r.rows.map((x) => [x.page_key as string, x.hidden as boolean]))
  } catch {
    return new Map()
  }
}

// Effective hidden pages: per-client overrides win over the '_global' default.
export async function getEffectiveHiddenKeys(clientId: string): Promise<Set<string>> {
  if (clientId === "_global") {
    const g = await loadPrefs("_global")
    return new Set([...g].filter(([, h]) => h).map(([k]) => k))
  }
  const [g, c] = await Promise.all([loadPrefs("_global"), loadPrefs(clientId)])
  const hidden = new Set<string>()
  for (const k of new Set([...g.keys(), ...c.keys()])) {
    const h = c.has(k) ? c.get(k)! : g.get(k) ?? false
    if (h) hidden.add(k)
  }
  return hidden
}

// Ordered nav for a specific client, with that client's hidden pages removed.
export async function getClientNav(clientId: string): Promise<NavPage[]> {
  const [all, order, hidden] = await Promise.all([getAllPages(), getNavOrder(), getEffectiveHiddenKeys(clientId)])
  const byKey = new Map(all.map((p) => [p.key, p]))
  const ordered: NavPage[] = []
  const seen = new Set<string>()
  if (order) for (const k of order) { const p = byKey.get(k); if (p) { ordered.push(p); seen.add(k) } }
  for (const p of all) if (!seen.has(p.key)) ordered.push(p)
  return ordered.filter((p) => !hidden.has(p.key))
}
