// eslint-disable-next-line @typescript-eslint/no-require-imports
const AnthropicSDK = require("@anthropic-ai/sdk")
// Support both ESM default export and CJS module shapes (important for Jest mocking)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnthropicCtor: new (opts: { apiKey: string }) => any =
  AnthropicSDK.default ?? AnthropicSDK

import { AirtableTask } from "./airtable"

function getClient() {
  return new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

export interface DashboardItem {
  id: string
  name: string
  dueDate: string | null
  status: "outstanding" | "in_progress" | "completed"
  overdue: boolean
  type: string
}

export interface DashboardSection {
  title: string
  items: DashboardItem[]
}

export interface DashboardData {
  sections: DashboardSection[]
}

const SYSTEM_PROMPT = `You are powering a client portal UI for Edwards Family Law.

Your job: interpret Airtable task records and organize them into three sections.

Rules:
- Always return exactly three sections with these titles in this order:
  1. "Outstanding Documents"
  2. "In Progress"
  3. "Completed"
- Map task Status field: Outstanding/Pending → "outstanding", In Progress/Under Review/Uploaded → "in_progress", Complete/Done → "completed"
- Set overdue: true when dueDate exists, is before today, and status is not "completed"
- Sort items within each section by dueDate ascending (nulls last)
- Use plain English — do not use legal jargon in item names
- Return ONLY valid JSON. No markdown, no explanation.

Output schema:
{
  "sections": [
    {
      "title": "Outstanding Documents",
      "items": [
        {
          "id": "string",
          "name": "string",
          "dueDate": "YYYY-MM-DD or null",
          "status": "outstanding",
          "overdue": false,
          "type": "string"
        }
      ]
    }
  ]
}`

export async function processTasks(
  tasks: AirtableTask[],
  today: string
): Promise<DashboardData> {
  const message = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Today's date: ${today}\n\nTasks:\n${JSON.stringify(tasks, null, 2)}`,
      },
    ],
  })

  const text = message.content[0].type === "text" ? message.content[0].text : ""
  try {
    return JSON.parse(text) as DashboardData
  } catch {
    return {
      sections: [
        { title: "Outstanding Documents", items: [] },
        { title: "In Progress", items: [] },
        { title: "Completed", items: [] },
      ],
    }
  }
}
