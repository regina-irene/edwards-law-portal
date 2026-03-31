// __tests__/api/nav.test.ts
import { GET, PUT } from "@/app/api/nav/route"
import { sql } from "@vercel/postgres"

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}))

jest.mock("@/auth", () => ({
  auth: jest.fn(),
}))

import { auth } from "@/auth"

const mockSql = sql as unknown as jest.Mock
const mockAuth = auth as jest.Mock

const DEFAULT_PAGES = ["dashboard", "document-requests", "pleadings", "discovery", "calendar", "messages", "chat"]

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { email: "test@test.com" } })
})

describe("GET /api/nav", () => {
  it("returns default order when no row exists", async () => {
    mockSql.mockResolvedValueOnce({ rows: [] })
    const req = new Request("http://localhost/api/nav")
    const res = await GET(req)
    const body = await res.json()
    expect(body.pages).toEqual(DEFAULT_PAGES)
  })

  it("returns stored order when row exists", async () => {
    const custom = ["chat", "dashboard", "messages"]
    mockSql.mockResolvedValueOnce({ rows: [{ pages: custom }] })
    const req = new Request("http://localhost/api/nav")
    const res = await GET(req)
    const body = await res.json()
    expect(body.pages).toEqual(custom)
  })
})

describe("PUT /api/nav", () => {
  it("saves new page order", async () => {
    const newOrder = ["messages", "dashboard", "chat"]
    mockSql.mockResolvedValueOnce({ rows: [] }) // check existing
    mockSql.mockResolvedValueOnce({ rows: [] }) // upsert
    const req = new Request("http://localhost/api/nav", {
      method: "PUT",
      body: JSON.stringify({ pages: newOrder }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
  })
})
