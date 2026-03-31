import { GET } from "@/app/api/messages/route"

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
})

describe("GET /api/messages", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null)
    const req = new Request("http://localhost/api/messages")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns messages for authenticated client", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "client@test.com" } })
    mockGetClient.mockResolvedValueOnce({ clientId: "C001" })
    mockSql
      .mockResolvedValueOnce({ rows: [] }) // mark read UPDATE
      .mockResolvedValueOnce({
        rows: [
          { id: "uuid-1", body: "Please submit your tax returns.", created_at: "2026-03-01T10:00:00Z", read: false },
        ],
      })
    const req = new Request("http://localhost/api/messages")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].body).toBe("Please submit your tax returns.")
  })
})
