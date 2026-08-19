"use server"

import { revalidatePath, revalidateTag } from "next/cache"

export async function refreshStatusPage() {
  // Case status is read through a 60-second cache. Re-rendering the path alone
  // would hand back the same cached record, so drop the tag first — otherwise
  // "Check for updates" could show the client exactly what they already had.
  // Next 16 requires the second argument; `expire: 0` evicts immediately.
  revalidateTag("case-status", { expire: 0 })
  revalidatePath("/status")
}
