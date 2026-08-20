// app/api/blob-upload/route.ts - mints a short-lived token so the BROWSER can
// upload straight to Vercel Blob (2026-08-20).
//
// The file bytes never pass through this function. That is the entire point:
// a serverless request body is capped at ~4.5 MB, which is what made a client's
// document production fail with a 413 while the portal promised 25 MB.
//
// Authorisation still happens here, before any token is issued. The token is
// scoped to one pathname prefix, so it cannot be reused to write anywhere else
// in the store. Blobs are written PRIVATE by the browser: `access` is chosen at
// the call site in lib/blob-upload-client, not here.
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { blobAuth, blobConfigured } from "@/lib/blob-token"
import { assertClientCanWrite } from "@/lib/client-write-guard"
import { ACCEPTED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/upload-limits"

export const runtime = "nodejs"

/** What the caller says it is doing, so the pathname can be scoped to it. */
type Scope = "client-upload" | "message" | "task" | "admin-upload"

const SCOPES: Scope[] = ["client-upload", "message", "task", "admin-upload"]

function isScope(v: unknown): v is Scope {
  return typeof v === "string" && (SCOPES as string[]).includes(v)
}

export async function POST(req: Request): Promise<NextResponse> {
  // Say this plainly rather than letting the SDK throw "No read-write token
  // found" from inside handleUpload, which reaches the person as a refused
  // upload and reaches the log looking like an authorisation failure. This is a
  // deployment problem, not something the person did wrong.
  if (!blobConfigured()) {
    console.error(
      "[blob-upload] no blob token: neither BLOB_READ_WRITE_TOKEN nor any *_BLOB_READ_WRITE_TOKEN is set in this environment"
    )
    return NextResponse.json(
      { error: "File uploads are not configured yet. Please contact support." },
      { status: 503 }
    )
  }

  const body = (await req.json().catch(() => null)) as HandleUploadBody | null
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  try {
    const result = await handleUpload({
      ...blobAuth(),
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // clientPayload is a JSON string the browser sent. It is UNTRUSTED:
        // it says what kind of upload this is, never who the user is.
        let scope: Scope = "client-upload"
        try {
          const parsed: unknown = clientPayload ? JSON.parse(clientPayload) : null
          const s = (parsed as { scope?: unknown } | null)?.scope
          if (isScope(s)) scope = s
        } catch {
          // fall through to the default scope
        }

        // The firm can upload anywhere. A client can only upload while their
        // case is open, and only under their own prefix.
        const admin = await requireAdmin()
        if (admin.status === "ok") {
          return {
            // No content-type filter for the firm. A family-law production is
            // full of .csv, .eml, .msg, .zip, .rtf and .mov, and the admin task
            // and dropzone uploads accepted anything before this route existed.
            // Refusing them here would be a regression, and the refusal reaches
            // the person as an SDK error rather than a sentence.
            allowedContentTypes: undefined,
            maximumSizeInBytes: MAX_UPLOAD_BYTES,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({ scope, by: "admin", email: admin.email }),
          }
        }

        if (scope === "admin-upload") throw new Error("Not authorised")

        const gate = await assertClientCanWrite()
        if (!gate.ok) throw new Error(gate.error)
        const clientId = String(gate.client.clientId)

        // Blob is only a staging area here, and `addRandomSuffix` keeps two
        // uploads of the same name apart. Which CLIENT a file belongs to is
        // never taken from this path: the finalize route reads it from the
        // session, so a tampered pathname cannot file into another client's
        // folder. The prefix check just keeps client tokens out of the areas
        // the firm uses.
        if (!pathname.startsWith("uploads/")) {
          throw new Error("Not authorised for that path")
        }

        // A client token does keep a list, and lib/upload-limits widened it to
        // the formats family-law discovery actually arrives in. The matching
        // `accept` on the input means the picker filters first, so a wrong file
        // is a greyed-out file rather than an error after the upload starts.
        return {
          allowedContentTypes: ACCEPTED_UPLOAD_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ scope, by: "client", clientId }),
        }
      },
      // Vercel calls this server-to-server once the browser finishes. We do NOT
      // do the Drive hand-off here: it cannot report a failure back to the
      // person waiting, and it does not fire in local development. The browser
      // calls the finalize route instead, which can say what happened.
      onUploadCompleted: async ({ blob }) => {
        console.log("[blob-upload] stored", blob.pathname)
      },
    })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload could not be authorised"
    console.error("[blob-upload] token refused:", message)
    // 400 rather than 500: handleUpload throws for refused authorisation as
    // well as genuine faults, and the browser shows this text.
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
