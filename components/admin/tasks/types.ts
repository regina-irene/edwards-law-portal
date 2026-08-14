// Shared shapes for the admin Tasks screen.
export interface Template {
  id: string
  title: string
  description: string | null
  stage: string | null
  tag: string | null
  notes: string | null
  form_key: string | null
  embed_url: string | null
  stage_order?: number
  sort_order?: number
  created_at: string
}

export interface ClientTask {
  id: string
  client_id: string
  title: string
  description: string | null
  status: "pending" | "done"
  due_date: string | null
  stage: string | null
  tag: string | null
  stage_order?: number
  sort_order?: number
  created_at: string
}

export interface Attachment {
  id: string
  file_name: string
  size: number | null
}

export interface FormSummary {
  key: string
  label: string
}

export type TabKey = "assign" | "templates" | "progress"
