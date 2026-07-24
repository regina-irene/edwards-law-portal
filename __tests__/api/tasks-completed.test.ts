import { PATCH } from "@/app/api/tasks/route"

jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/db", () => ({ sql: jest.fn() }))
jest.mock("@/lib/airtable", () => ({ getClientByEmail: jest.fn() }))
jest.mock("@/lib/portal-client", () => ({ getPortalClient: jest.fn() }))
jest.mock("@/lib/task-attachments", () => ({ getTemplateAttachments: jest.fn(), getClientTaskAttachments: jest.fn() }))

import { auth } from "@/auth"
import { sql } from "@/lib/db"
import { getClientByEmail } from "@/lib/airtable"

const mockAuth = auth as jest.Mock
const mockSql = sql as unknown as jest.Mock
const mockGetClient = getClientByEmail as jest.Mock

beforeEach(() => jest.clearAllMocks())

function patchReq(body: unknown): Request {
  return new Request("http://localhost/api/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("PATCH /api/tasks completed_at", () => {
  it("stamps completed_at when marking done", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "c@x.com" } })
    mockGetClient.mockResolvedValueOnce({ clientId: "rec123" })
    mockSql.mockResolvedValueOnce({ rows: [{ id: "t1", status: "done" }] })
    const res = await PATCH(patchReq({ id: "t1", status: "done" }))
    expect(res.status).toBe(200)
    const queryText = (mockSql.mock.calls[0][0] as TemplateStringsArray).join("?")
    expect(queryText).toContain("completed_at")
    expect(queryText).toMatch(/CASE WHEN [\s\S]* THEN NOW\(\) ELSE NULL END/)
  })
})
