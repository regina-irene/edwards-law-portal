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

async function getHiddenKeys(clientId: string): Promise<Set<string>> {
  try {
    const r = await sql`SELECT page_key FROM client_page_prefs WHERE client_id = ${clientId} AND hidden = true`
    return new Set(r.rows.map((x) => x.page_key as string))
  } catch {
    return new Set()
  }
}

// Ordered nav for a specific client, with that client's hidden pages removed.
export async function getClientNav(clientId: string): Promise<NavPage[]> {
  const [all, order, hidden] = await Promise.all([getAllPages(), getNavOrder(), getHiddenKeys(clientId)])
  const byKey = new Map(all.map((p) => [p.key, p]))
  const ordered: NavPage[] = []
  const seen = new Set<string>()
  if (order) for (const k of order) { const p = byKey.get(k); if (p) { ordered.push(p); seen.add(k) } }
  for (const p of all) if (!seen.has(p.key)) ordered.push(p)
  return ordered.filter((p) => !hidden.has(p.key))
}
