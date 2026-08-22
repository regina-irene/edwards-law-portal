"use server"

import { revalidatePath } from "next/cache"
import { revalidateDiscoveryBoard } from "@/lib/discovery-board"

// The board reads every client base through a five-minute cache, so a plain
// re-render would hand back the same rows. Drop the cached copy, then re-render.
export async function refreshDiscoveryBoard() {
  revalidateDiscoveryBoard()
  revalidatePath("/admin/discovery")
}
