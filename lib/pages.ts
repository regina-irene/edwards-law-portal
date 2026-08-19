// lib/pages.ts
export const PORTAL_PAGES = [
  "dashboard",
  "pleadings",
  "correspondence",
  "discovery",
  "status",
  "tasks",
  "calendar",
  "messages",
  "settings",
] as const

export type PortalPage = (typeof PORTAL_PAGES)[number]
