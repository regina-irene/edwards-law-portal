// lib/admin-prefs.ts — firm-wide look of the ADMIN side (2026-08-18).
// Stored in the app_settings key/value table rather than a new table, so
// there is no schema change: one scheme + gradient flag for the whole firm.
// Defaults reproduce the admin colors exactly as they were before the picker
// existed, so an untouched install looks identical.
import { getSetting, setSetting } from "@/lib/app-settings"
import { DEFAULT_SCHEME_KEY, getScheme } from "@/lib/color-schemes"

export const ADMIN_SCHEME_KEY = "admin_scheme"
export const ADMIN_GRADIENT_KEY = "admin_gradient"

export interface AdminPrefs {
  scheme: string
  gradient: boolean
}

const DEFAULTS: AdminPrefs = { scheme: DEFAULT_SCHEME_KEY, gradient: false }

export async function getAdminPrefs(): Promise<AdminPrefs> {
  try {
    const [scheme, gradient] = await Promise.all([
      getSetting(ADMIN_SCHEME_KEY),
      getSetting(ADMIN_GRADIENT_KEY),
    ])
    return {
      scheme: getScheme(scheme || null).key,
      gradient: gradient === "true",
    }
  } catch {
    return DEFAULTS
  }
}

export async function saveAdminPrefs(prefs: AdminPrefs): Promise<void> {
  await setSetting(ADMIN_SCHEME_KEY, getScheme(prefs.scheme).key)
  await setSetting(ADMIN_GRADIENT_KEY, prefs.gradient ? "true" : "false")
}
