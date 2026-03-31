import { GET, POST } from "@/app/api/chat/route"

jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/airtable", () => ({ getClientByEmail: jest.fn() }))
jest.mock("@/lib/db", () => ({ sql: jest.fn() }))

import { auth } from "@/auth"
import { getClientByEmail } from "@/lib/airtable"
import { sql } from "@/lib/db"

const mockAuth = auth as jest.Mock
const mockGetClient = getClientByEmail as jest.Mock
const mockSql = sql as unknown as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { email: "client@test.com" } })
  mockGetClient.mockResolvedValue({ clientId: "C001" })
})

describe("GET /api/chat", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null)
    const req = new Request("http://localhost/api/chat")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns chat messages", async () => {
    mockSql
      .mockResolvedValueOnce({ rows: [] }) // mark read UPDATE
      .mockResolvedValueOnce({
        rows: [{ id: "uuid-1", sender: "firm", body: "Hello!", created_at: "2026-03-01T10:00:00Z" }],
      })
    const req = new Request("http://localhost/api/chat")
    const res = await GET(req)
    const body = await res.json()
    expect(body.messages).toHaveLength(1)
  })
})

describe("POST /api/chat", () => {
  it("saves a client message", async () => {
    mockSql.mockResolvedValueOnce({ rows: [{ id: "new-uuid", sender: "client", body: "Hi", created_at: new Date().toISOString() }] })
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ body: "Hi" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it("rejects empty message body", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ body: "" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
