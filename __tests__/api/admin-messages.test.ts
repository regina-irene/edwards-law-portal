import { POST } from "@/app/api/admin/messages/route"

jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/db", () => ({ sql: jest.fn() }))

import { auth } from "@/auth"
import { sql } from "@/lib/db"

const mockAuth = auth as jest.Mock
const mockSql = sql as unknown as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("POST /api/admin/messages", () => {
  it("returns 403 for non-admin", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "client@test.com" } })
    mockSql.mockResolvedValueOnce({ rows: [] }) // not in admin_users
    const req = new Request("http://localhost/api/admin/messages", {
      method: "POST",
      body: JSON.stringify({ clientId: "C001", body: "Please submit your documents." }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("posts an announcement as admin", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "admin@edwardslaw.com" } })
    mockSql.mockResolvedValueOnce({ rows: [{ email: "admin@edwardslaw.com" }] }) // is admin
    mockSql.mockResolvedValueOnce({
      rows: [{ id: "uuid-1", body: "Please submit your documents.", created_at: new Date().toISOString() }],
    })
    const req = new Request("http://localhost/api/admin/messages", {
      method: "POST",
      body: JSON.stringify({ clientId: "C001", body: "Please submit your documents." }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it("returns 401 for unauthenticated request", async () => {
    mockAuth.mockResolvedValueOnce(null)
    const req = new Request("http://localhost/api/admin/messages", {
      method: "POST",
      body: JSON.stringify({ clientId: "C001", body: "test" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 when body is missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "admin@edwardslaw.com" } })
    mockSql.mockResolvedValueOnce({ rows: [{ email: "admin@edwardslaw.com" }] })
    const req = new Request("http://localhost/api/admin/messages", {
      method: "POST",
      body: JSON.stringify({ clientId: "C001" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
