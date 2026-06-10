// __tests__/api/nav.test.ts
import { GET, PUT } from "@/app/api/nav/route"

jest.mock("@/lib/db", () => ({
  sql: jest.fn(),
}))

import { sql } from "@/lib/db"

jest.mock("@/auth", () => ({
  auth: jest.fn(),
}))

import { auth } from "@/auth"


const mockSql = sql as unknown as jest.Mock
const mockAuth = auth as jest.Mock

const DEFAULT_PAGES = ["dashboard", "pleadings", "discovery", "calendar", "messages", "settings"]

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

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null)
    const req = new Request("http://localhost/api/nav")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})

describe("PUT /api/nav", () => {
  it("saves new page order", async () => {
    const newOrder = ["messages", "dashboard", "chat"]
    mockSql.mockResolvedValueOnce({ rows: [{ id: "existing-uuid" }] }) // SELECT existing
    mockSql.mockResolvedValueOnce({ rows: [] }) // UPDATE
    const req = new Request("http://localhost/api/nav", {
      method: "PUT",
      body: JSON.stringify({ pages: newOrder }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pages).toEqual(newOrder)
  })

  it("inserts when no existing row", async () => {
    const newOrder = ["chat", "dashboard"]
    mockSql.mockResolvedValueOnce({ rows: [] }) // SELECT - no row
    mockSql.mockResolvedValueOnce({ rows: [] }) // INSERT
    const req = new Request("http://localhost/api/nav", {
      method: "PUT",
      body: JSON.stringify({ pages: newOrder }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pages).toEqual(newOrder)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null)
    const req = new Request("http://localhost/api/nav", {
      method: "PUT",
      body: JSON.stringify({ pages: ["dashboard"] }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 when pages is not an array", async () => {
    const req = new Request("http://localhost/api/nav", {
      method: "PUT",
      body: JSON.stringify({ pages: "not-an-array" }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
  })
})
