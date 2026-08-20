"use server"

import { revalidatePath } from "next/cache"
import { revalidateDocBoard } from "@/lib/doc-board"

// The board reads every client's base through a five-minute cache (it is many
// Airtable calls, not one), so a plain re-render would hand back the same rows.
// Drop the cached copy first, then re-render.
export async function refreshDocBoard() {
  revalidateDocBoard()
  revalidatePath("/admin/documents")
}
