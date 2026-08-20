"use client"
// components/admin/tasks/CustomTaskPanel.tsx - send a one-off task that isn't on
// the template board: a title, rich text instructions, a link and files, to one
// client or several. The task rows are created first (an attachment hangs off a
// task id, so the row has to exist), then each file is uploaded to every task
// that was created.
import { useMemo, useRef, useState, type ReactElement } from "react"
import { RichTextEditor, normalizeUrl } from "@/components/ui/RichTextEditor"
import { uploadToBlob } from "@/lib/blob-upload-client"
import { UPLOAD_ACCEPT_ATTR, prettyBytes, tooBigMessage } from "@/lib/upload-limits"
import ClientCombobox, { type ClientOption } from "./ClientCombobox"
import { InlineError } from "./bits"

interface CreatedTask {
  id: string
  client_id: string
}

type FileState = "waiting" | "uploading" | "done" | "error"

interface PendingFile {
  key: string
  file: File
  progress: number
  state: FileState
  error: string | null
}

export default function CustomTaskPanel({
  clients,
  labelOf,
  reload,
}: {
  clients: ClientOption[]
  labelOf: (clientId: string) => string
  reload: () => Promise<void> | void
}): ReactElement {
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [includeArchived, setIncludeArchived] = useState(false)
  const [title, setTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [link, setLink] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [files, setFiles] = useState<PendingFile[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const archivedCount = clients.filter((c) => c.archived).length
  // Same rule as the assign panel: anyone already picked stays pickable, so
  // turning the toggle back off can never quietly drop them.
  const pickable = useMemo(
    () => clients.filter((c) => includeArchived || !c.archived || selectedClients.includes(c.id)),
    [clients, includeArchived, selectedClients]
  )

  const clientWord =
    selectedClients.length === 1
      ? labelOf(selectedClients[0])
      : `${selectedClients.length} clients`

  const disabledReason = !selectedClients.length
    ? "Pick at least one client first"
    : !title.trim()
      ? "Give the task a title"
      : undefined

  const canSend = !disabledReason && !sending

  function updateFile(key: string, patch: Partial<PendingFile>): void {
    setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)))
  }

  function addFiles(picked: FileList | null): void {
    if (!picked || picked.length === 0) return
    const next: PendingFile[] = []
    for (const file of Array.from(picked)) {
      const tooBig = tooBigMessage(file)
      next.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        progress: 0,
        state: tooBig ? "error" : "waiting",
        error: tooBig,
      })
    }
    setFiles((prev) => [...prev, ...next])
  }

  function removeFile(key: string): void {
    setFiles((prev) => prev.filter((f) => f.key !== key))
  }

  async function send(): Promise<void> {
    setError(null)
    setSuccess(null)
    if (!selectedClients.length) {
      setError("Pick at least one client to send this task to.")
      return
    }
    if (!title.trim()) {
      setError("Give the task a title so the client knows what it is.")
      return
    }

    setSending(true)
    // The task rows first: a file is attached to a task id, so the rows have to
    // exist before anything can be uploaded.
    let created: CreatedTask[] = []
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          clientIds: selectedClients,
          title: title.trim(),
          notes: instructions,
          embedUrl: link.trim() ? normalizeUrl(link) : "",
          dueDate: dueDate || undefined,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "That task wasn't sent. Please try again.")
      }
      const data = (await res.json().catch(() => null)) as { tasks?: CreatedTask[] } | null
      created = (data?.tasks ?? []).filter((t) => Boolean(t?.id))
      if (created.length === 0) throw new Error("That task wasn't sent. Please try again.")
    } catch (e) {
      setSending(false)
      setError(e instanceof Error ? e.message : "That task wasn't sent. Please try again.")
      return
    }

    // Then the files, once per created task. A file that fails is named, and
    // the message says plainly that the task itself did go out.
    const queued = files.filter((f) => f.state !== "done")
    const failedNames: string[] = []
    for (const item of queued) {
      const tooBig = tooBigMessage(item.file)
      if (tooBig) {
        updateFile(item.key, { state: "error", error: tooBig })
        failedNames.push(item.file.name)
        continue
      }
      updateFile(item.key, { state: "uploading", progress: 0, error: null })
      let ok = true
      let why = ""
      for (let i = 0; i < created.length; i++) {
        const task = created[i]
        try {
          const blob = await uploadToBlob(item.file, {
            scope: "task",
            pathnamePrefix: `tasks/client_task/${task.id}`,
            onProgress: (pct) =>
              updateFile(item.key, {
                progress: Math.round(((i + pct / 100) / created.length) * 100),
              }),
          })
          const res = await fetch("/api/task-files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // No pathname: the route derives it from the url.
            body: JSON.stringify({
              scope: "client_task",
              refId: task.id,
              url: blob.url,
              fileName: item.file.name,
              contentType: blob.contentType,
              size: item.file.size,
            }),
          })
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { error?: string } | null
            throw new Error(data?.error || "That file didn't save.")
          }
        } catch (e) {
          ok = false
          const reason = e instanceof Error ? e.message : "That file didn't save."
          why = created.length > 1 ? `${reason} (${labelOf(task.client_id)})` : reason
          break
        }
      }
      if (ok) {
        updateFile(item.key, { state: "done", progress: 100, error: null })
      } else {
        updateFile(item.key, { state: "error", error: why })
        failedNames.push(item.file.name)
      }
    }

    setSending(false)
    await reload()

    const filePart = queued.length
      ? ` with ${queued.length - failedNames.length} of ${queued.length} ${queued.length === 1 ? "file" : "files"}`
      : ""
    if (failedNames.length) {
      setError(
        `The task WAS created and sent to ${clientWord}. What didn't attach: ${failedNames.join(", ")}. The reason is next to each file below. Don't press Send again - that would create a second task.`
      )
      return
    }

    setSuccess(`Sent “${title.trim()}” to ${clientWord}${filePart}.`)
    // Clear the task, keep the people: several tasks often go to the same person.
    setTitle("")
    setInstructions("")
    setLink("")
    setDueDate("")
    setFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h2 className="serif text-lg font-semibold text-gray-900">Send a custom task</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          A one-off task that isn&apos;t on the template board. It shows up on the client&apos;s task
          list like any other.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 items-start">
        <div className="flex-1 min-w-[16rem]">
          <ClientCombobox clients={pickable} selected={selectedClients} onChange={setSelectedClients} />
          <label
            className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer select-none"
            title="Show former and closed cases in the picker"
          >
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            Include archived
            {archivedCount > 0 && <span className="text-gray-400">({archivedCount})</span>}
          </label>
          {selectedClients.some((id) => clients.find((c) => c.id === id)?.archived) && (
            <p className="mt-1 text-[11px] text-amber-700">
              One of the clients you&apos;ve picked is archived - they may not be able to open a new task.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="custom-due" className="text-xs font-semibold text-gray-500">
            Due date (optional)
          </label>
          <input
            id="custom-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="custom-title" className="text-xs font-semibold text-gray-500">
          Title
        </label>
        <input
          id="custom-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bring your 2025 tax return to the next meeting"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-1">
        <span className="block text-xs font-semibold text-gray-500">Instructions (optional)</span>
        <RichTextEditor value={instructions} onChange={setInstructions} />
      </div>

      <div className="space-y-1">
        <label htmlFor="custom-link" className="text-xs font-semibold text-gray-500">
          Link (optional)
        </label>
        <input
          id="custom-link"
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="airtable.com/… or tinyurl.com/eflupload"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="block text-[11px] text-gray-400">
          You can leave the https:// off. The client gets an &ldquo;open in new tab&rdquo; link on the
          task; an Airtable form also opens in place.
        </span>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-semibold text-gray-500">Files (optional)</span>
        <label className="inline-flex items-center gap-2 text-sm text-blue-600 cursor-pointer hover:underline">
          + Attach files
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={UPLOAD_ACCEPT_ATTR}
            className="hidden"
            disabled={sending}
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ""
            }}
          />
        </label>
        {files.length > 0 && (
          <ul className="space-y-1.5 border border-gray-200 rounded-lg p-2">
            {files.map((f) => (
              <li key={f.key} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 truncate text-gray-800">{f.file.name}</span>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">{prettyBytes(f.file.size)}</span>
                  {f.state === "uploading" && (
                    <span className="text-[11px] text-blue-600 tabular-nums whitespace-nowrap">{f.progress}%</span>
                  )}
                  {f.state === "done" && <span className="text-[11px] text-green-700 whitespace-nowrap">Attached</span>}
                  {f.state === "error" && <span className="text-[11px] text-red-600 whitespace-nowrap">Failed</span>}
                  {!sending && (
                    <button
                      type="button"
                      onClick={() => removeFile(f.key)}
                      aria-label={`Remove ${f.file.name}`}
                      className="text-xs text-gray-300 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {f.state === "uploading" && (
                  <div className="mt-1 h-1 w-full rounded bg-gray-100 overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${f.progress}%` }} />
                  </div>
                )}
                {f.error && <p className="mt-0.5 text-[11px] text-red-600">{f.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          title={disabledReason}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {sending
            ? "Sending…"
            : selectedClients.length
              ? `Send to ${clientWord}`
              : "Send custom task"}
        </button>
        {disabledReason && <span className="text-xs text-gray-400">{disabledReason}.</span>}
      </div>

      {success && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>
      )}
      {error && <InlineError message={error} />}
    </section>
  )
}
