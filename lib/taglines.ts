// lib/taglines.ts - one-line taglines under page titles (Thistle-style).
// Client keys match lib/portal-pages.ts page keys; admin keys use "admin:".
// Custom pages have no tagline (taglineFor returns null → nothing renders).
const TAGLINES: Record<string, string> = {
  dashboard: "Your case, at a glance",
  pleadings: "Every document filed in your case",
  correspondence: "Letters sent and received in your case",
  discovery: "Requests and responses, both directions",
  status: "Where things stand - and what's been paid",
  tasks: "What needs doing, and when",
  calendar: "Every date in your case, in one place",
  messages: "Talk to your legal team",
  settings: "Make the portal yours",
  "admin:dashboard": "The whole practice, at a glance",
  "admin:clients": "Every client, one list",
  "admin:tasks": "Templates, assignments, progress",
  "admin:notes": "Your private case log - clients never see this",
  "admin:status": "Where every case stands, in plain English",
  "admin:documents": "Every filing and letter, across every case",
  "admin:discovery": "What each client can see, and what they cannot",
  "admin:messages": "Every client conversation",
  "admin:pages": "What clients see on every page",
  "admin:settings": "Pages, navigation, and defaults",
}

export function taglineFor(key: string): string | null {
  return TAGLINES[key] ?? null
}
