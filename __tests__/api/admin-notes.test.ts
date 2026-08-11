import { GET, POST, PATCH, DELETE } from "@/app/api/admin/notes/route"

jest.mock("@/lib/admin", () => ({ requireAdmin: jest.fn() }))
jest.mock("@/lib/notes", () => ({
  listNotes: jest.fn(),
  createNote: jest.fn(),
  updateNote: jest.fn(),
  deleteNote: jest.fn(),
}))

import { requireAdmin } from "@/lib/admin"
import { listNotes, createNote, updateNote, deleteNote } from "@/lib/notes"

const mockAdmin = requireAdmin as jest.Mock
const mockList = listNotes as jest.Mock
const mockCreate = createNote as jest.Mock
const mockUpdate = updateNote as jest.Mock
const mockDelete = deleteNote as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe("/api/admin/notes", () => {
  it("GET returns 403 for non-admin", async () => {
    mockAdmin.mockResolvedValueOnce({ status: "forbidden" })
    const res = await GET(new Request("http://x/api/admin/notes?clientId=rec1"))
    expect(res.status).toBe(403)
  })

  it("GET returns 401 when unauthenticated", async () => {
    mockAdmin.mockResolvedValueOnce({ status: "unauthenticated" })
    const res = await GET(new Request("http://x/api/admin/notes?clientId=rec1"))
    expect(res.status).toBe(401)
  })

  it("GET lists notes for a client", async () => {
    mockAdmin.mockResolvedValueOnce({ status: "ok", email: "a@b.c", name: "Ada" })
    mockList.mockResolvedValueOnce([{ id: "n1", body: "<p>x</p>", created_at: "2026-07-24", updated_at: null }])
    const res = await GET(new Request("http://x/api/admin/notes?clientId=rec1"))
    expect(res.status).toBe(200)
    expect((await res.json()).notes).toHaveLength(1)
  })

  it("POST creates a note", async () => {
    mockAdmin.mockResolvedValueOnce({ status: "ok", email: "a@b.c", name: "Ada" })
    mockCreate.mockResolvedValueOnce({ id: "n1", body: "<p>x</p>", created_at: "2026-07-24", updated_at: null })
    const res = await POST(new Request("http://x/api/admin/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "rec1", body: "<p>x</p>" }),
    }))
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith("rec1", "<p>x</p>", { email: "a@b.c", name: "Ada" })
  })

  it("POST rejects empty body", async () => {
    mockAdmin.mockResolvedValueOnce({ status: "ok", email: "a@b.c", name: "Ada" })
    const res = await POST(new Request("http://x/api/admin/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "rec1", body: "   " }),
    }))
    expect(res.status).toBe(400)
  })

  it("PATCH updates a note", async () => {
    mockAdmin.mockResolvedValueOnce({ status: "ok", email: "a@b.c", name: "Ada" })
    mockUpdate.mockResolvedValueOnce({ id: "n1", body: "<p>y</p>", created_at: "2026-07-24", updated_at: "2026-07-24" })
    const res = await PATCH(new Request("http://x/api/admin/notes", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "n1", body: "<p>y</p>" }),
    }))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith("n1", "<p>y</p>")
  })

  it("DELETE returns 404 when note not found", async () => {
    mockAdmin.mockResolvedValueOnce({ status: "ok", email: "a@b.c", name: "Ada" })
    mockDelete.mockResolvedValueOnce(false)
    const res = await DELETE(new Request("http://x/api/admin/notes?id=n9", { method: "DELETE" }))
    expect(res.status).toBe(404)
  })
})
