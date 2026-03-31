import { GET, POST } from "@/app/api/admin/chat/route"

jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/db", () => ({ sql: jest.fn() }))

import { auth } from "@/auth"
import { sql } from "@/lib/db"

const mockAuth = auth as jest.Mock
const mockSql = sql as unknown as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("GET /api/admin/chat", () => {
  it("returns 403 for non-admin", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "client@test.com" } })
    mockSql.mockResolvedValueOnce({ rows: [] }) // not in admin_users
    const req = new Request("http://localhost/api/admin/chat?clientId=C001")
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it("returns chat messages for admin", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "admin@edwardslaw.com" } })
    mockSql.mockResolvedValueOnce({ rows: [{ email: "admin@edwardslaw.com" }] }) // is admin
    mockSql.mockResolvedValueOnce({
      rows: [{ id: "uuid-1", sender: "client", body: "Hello", created_at: "2026-03-01T10:00:00Z" }],
    })
    const req = new Request("http://localhost/api/admin/chat?clientId=C001")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.messages).toHaveLength(1)
  })

  it("returns 401 for unauthenticated request", async () => {
    mockAuth.mockResolvedValueOnce(null)
    const req = new Request("http://localhost/api/admin/chat?clientId=C001")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 when clientId is missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "admin@edwardslaw.com" } })
    mockSql.mockResolvedValueOnce({ rows: [{ email: "admin@edwardslaw.com" }] })
    const req = new Request("http://localhost/api/admin/chat")
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})

describe("POST /api/admin/chat", () => {
  it("posts a firm reply", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "admin@edwardslaw.com" } })
    mockSql.mockResolvedValueOnce({ rows: [{ email: "admin@edwardslaw.com" }] }) // is admin
    mockSql.mockResolvedValueOnce({
      rows: [{ id: "new-uuid", sender: "firm", body: "Got it.", created_at: new Date().toISOString() }],
    })
    const req = new Request("http://localhost/api/admin/chat", {
      method: "POST",
      body: JSON.stringify({ clientId: "C001", body: "Got it." }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})
