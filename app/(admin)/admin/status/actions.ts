"use server"

import { revalidatePath } from "next/cache"
import { revalidateCaseStatus } from "@/lib/case-status"

// The board reads Airtable through a 60-second cache, so a plain re-render
// would hand back the same rows. Drop the cached copy first, then re-render.
export async function refreshStatusBoard() {
  revalidateCaseStatus()
  revalidatePath("/admin/status")
}
