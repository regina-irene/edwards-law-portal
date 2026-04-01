// lib/pages.ts
export const PORTAL_PAGES = [
  "dashboard",
  "document-requests",
  "pleadings",
  "discovery",
  "status",
  "tasks",
  "calendar",
  "messages",
  "chat",
] as const

export type PortalPage = (typeof PORTAL_PAGES)[number]
