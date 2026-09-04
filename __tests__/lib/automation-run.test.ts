// The automations are the only part of the portal that can email a client
// with nobody at the firm in the loop, so the three safety rules in
// lib/automations are worth pinning down in tests rather than trusting.
jest.mock("@/lib/airtable", () => ({ getAllClients: jest.fn() }))
jest.mock("@/lib/pleadings", () => ({ getPleadings: jest.fn() }))
jest.mock("@/lib/correspondence", () => ({ getCorrespondence: jest.fn() }))
jest.mock("@/lib/resend", () => ({ sendNewDocumentsEmail: jest.fn() }))
jest.mock("@/lib/automations", () => {
  const actual = jest.requireActual("@/lib/automations")
  return {
    ...actual,
    ensureAutomationTables: jest.fn().mockResolvedValue(undefined),
    listRules: jest.fn(),
    hasSeenClient: jest.fn(),
    seenRecordIds: jest.fn(),
    markSeen: jest.fn().mockResolvedValue(undefined),
    enqueue: jest.fn().mockResolvedValue(1),
  }
})

import { runAutomations } from "@/lib/automation-run"
import { getAllClients } from "@/lib/airtable"
import { getPleadings } from "@/lib/pleadings"
import { sendNewDocumentsEmail } from "@/lib/resend"
import { listRules, hasSeenClient, seenRecordIds, markSeen, enqueue } from "@/lib/automations"

const mockClients = getAllClients as jest.Mock
const mockPleadings = getPleadings as jest.Mock
const mockSend = sendNewDocumentsEmail as jest.Mock
const mockListRules = listRules as jest.Mock
const mockHasSeen = hasSeenClient as jest.Mock
const mockSeenIds = seenRecordIds as jest.Mock
const mockMarkSeen = markSeen as jest.Mock
const mockEnqueue = enqueue as jest.Mock

const CLIENT = {
  id: "rec1",
  clientId: "recClient1",
  name: "Gichana | Culix",
  email: "client@example.com",
  phone: "",
  clientBaseId: "appClientBase",
  statusOfCase: "",
  smsReminders: false,
  noMessageEmails: false,
  archived: false,
}

function rule(over: Partial<{ enabled: boolean; mode: "auto" | "approve" }> = {}) {
  return [
    {
      key: "new-pleading",
      label: "New filing",
      description: "",
      board: "pleadings",
      enabled: true,
      mode: "auto",
      ...over,
    },
    {
      key: "new-correspondence",
      label: "New letter",
      description: "",
      board: "correspondence",
      enabled: false,
      mode: "approve",
    },
  ]
}

function docs(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `recDoc${i}`,
    title: `2026.09.0${i} Motion`,
    filedOn: "2026-09-01",
    created: null,
    filedBy: "",
    fileType: "pdf",
    link: `https://drive.google.com/file/${i}`,
    notes: "",
    folder: null,
  }))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockClients.mockResolvedValue([CLIENT])
  mockSeenIds.mockResolvedValue(new Set<string>())
})

describe("runAutomations", () => {
  it("sends nothing at all when every rule is off", async () => {
    mockListRules.mockResolvedValue(rule({ enabled: false }))
    const out = await runAutomations()
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockEnqueue).not.toHaveBeenCalled()
    expect(out["new-pleading"].ran).toBe(false)
  })

  it("SAFETY RULE 2: the first look at a client sends nothing and marks history as seen", async () => {
    mockListRules.mockResolvedValue(rule())
    mockHasSeen.mockResolvedValue(false)
    mockPleadings.mockResolvedValue(docs(40))

    const out = await runAutomations()

    expect(mockSend).not.toHaveBeenCalled()
    expect(mockEnqueue).not.toHaveBeenCalled()
    expect(out["new-pleading"].seeded).toBe(1)
    // All 40 recorded, so tomorrow's run treats only genuinely new ones as new.
    expect(mockMarkSeen).toHaveBeenCalledWith("new-pleading", "recClient1", expect.arrayContaining(["recDoc0", "recDoc39"]))
  })

  it("emails the client about a genuinely new document", async () => {
    mockListRules.mockResolvedValue(rule())
    mockHasSeen.mockResolvedValue(true)
    mockSeenIds.mockResolvedValue(new Set(["recDoc0"]))
    mockPleadings.mockResolvedValue(docs(2))

    const out = await runAutomations()

    expect(mockSend).toHaveBeenCalledTimes(1)
    const arg = mockSend.mock.calls[0][0]
    expect(arg.to).toBe("client@example.com")
    expect(arg.firstName).toBe("Culix")
    expect(arg.documents).toHaveLength(1)
    expect(arg.documents[0].id).toBe("recDoc1")
    expect(out["new-pleading"].sent).toBe(1)
  })

  it("marks documents as seen BEFORE sending, so a failure cannot loop", async () => {
    mockListRules.mockResolvedValue(rule())
    mockHasSeen.mockResolvedValue(true)
    mockPleadings.mockResolvedValue(docs(1))
    mockSend.mockRejectedValueOnce(new Error("Resend is down"))

    const out = await runAutomations()

    expect(mockMarkSeen).toHaveBeenCalledWith("new-pleading", "recClient1", ["recDoc0"])
    expect(out["new-pleading"].errors).toHaveLength(1)
    // Recorded as failed so it shows on the page rather than vanishing.
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }))
  })

  it("SAFETY RULE 3: a big batch waits for approval even on automatic", async () => {
    mockListRules.mockResolvedValue(rule())
    mockHasSeen.mockResolvedValue(true)
    mockPleadings.mockResolvedValue(docs(20))

    const out = await runAutomations()

    expect(mockSend).not.toHaveBeenCalled()
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }))
    expect(out["new-pleading"].queued).toBe(1)
  })

  it("queues instead of sending when the rule is set to show her first", async () => {
    mockListRules.mockResolvedValue(rule({ mode: "approve" }))
    mockHasSeen.mockResolvedValue(true)
    mockPleadings.mockResolvedValue(docs(1))

    await runAutomations()

    expect(mockSend).not.toHaveBeenCalled()
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }))
  })

  it("does nothing when the board cannot be read, rather than treating it as empty", async () => {
    mockListRules.mockResolvedValue(rule())
    mockHasSeen.mockResolvedValue(true)
    mockPleadings.mockResolvedValue(null)

    const out = await runAutomations()

    expect(mockMarkSeen).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
    expect(out["new-pleading"].skipped).toBe(1)
  })

  it("skips archived clients entirely", async () => {
    mockClients.mockResolvedValue([{ ...CLIENT, archived: true }])
    mockListRules.mockResolvedValue(rule())
    mockHasSeen.mockResolvedValue(true)
    mockPleadings.mockResolvedValue(docs(1))

    await runAutomations()

    expect(mockPleadings).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("honours a client who has asked not to be emailed, but still records the document", async () => {
    mockClients.mockResolvedValue([{ ...CLIENT, noMessageEmails: true }])
    mockListRules.mockResolvedValue(rule())
    mockHasSeen.mockResolvedValue(true)
    mockPleadings.mockResolvedValue(docs(1))

    const out = await runAutomations()

    expect(mockSend).not.toHaveBeenCalled()
    expect(mockEnqueue).not.toHaveBeenCalled()
    expect(mockMarkSeen).toHaveBeenCalled()
    expect(out["new-pleading"].skipped).toBe(1)
  })
})
