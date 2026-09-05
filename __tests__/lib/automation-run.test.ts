// The automations are the only part of the portal that can email a client
// with nobody at the firm in the loop, so the three safety rules in
// lib/automations are worth pinning down in tests rather than trusting.
jest.mock("@/lib/airtable", () => ({ getAllClients: jest.fn() }))
jest.mock("@/lib/pleadings", () => ({ getPleadings: jest.fn() }))
jest.mock("@/lib/correspondence", () => ({ getCorrespondence: jest.fn() }))
jest.mock("@/lib/discovery", () => ({ getDiscovery: jest.fn() }))
jest.mock("@/lib/calendar", () => ({ getCaseEvents: jest.fn() }))
jest.mock("@/lib/case-status", () => ({ listAllCaseStatuses: jest.fn() }))
jest.mock("@/lib/db", () => ({ sql: jest.fn().mockResolvedValue({ rows: [] }) }))
jest.mock("@/lib/automation-window", () => {
  const actual = jest.requireActual("@/lib/automation-window")
  return { ...actual, getSendWindow: jest.fn() }
})
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
import { DEFAULT_SUBJECT, DEFAULT_BODY } from "@/lib/automation-email"
import { getAllClients } from "@/lib/airtable"
import { getPleadings } from "@/lib/pleadings"
import { getDiscovery } from "@/lib/discovery"
import { getCaseEvents } from "@/lib/calendar"
import { listAllCaseStatuses } from "@/lib/case-status"
import { sendNewDocumentsEmail } from "@/lib/resend"
import { listRules, hasSeenClient, seenRecordIds, markSeen, enqueue } from "@/lib/automations"
import { getSendWindow, DEFAULT_WINDOW } from "@/lib/automation-window"

const mockClients = getAllClients as jest.Mock
const mockPleadings = getPleadings as jest.Mock
const mockDiscovery = getDiscovery as jest.Mock
const mockEvents = getCaseEvents as jest.Mock
const mockStatuses = listAllCaseStatuses as jest.Mock
const mockSend = sendNewDocumentsEmail as jest.Mock
const mockListRules = listRules as jest.Mock
const mockHasSeen = hasSeenClient as jest.Mock
const mockSeenIds = seenRecordIds as jest.Mock
const mockMarkSeen = markSeen as jest.Mock
const mockEnqueue = enqueue as jest.Mock
const mockWindow = getSendWindow as jest.Mock

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
      kind: "documents",
      board: "pleadings",
      noun: "filing",
      enabled: true,
      mode: "auto",
      subject: DEFAULT_SUBJECT,
      body: DEFAULT_BODY,
      ...over,
    },
    {
      key: "new-correspondence",
      label: "New letter",
      description: "",
      kind: "documents",
      board: "correspondence",
      noun: "letter",
      enabled: false,
      mode: "approve",
      subject: DEFAULT_SUBJECT,
      body: DEFAULT_BODY,
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
  // Most tests are about what the scan does, not when, so the hours are off by
  // default here and switched on only by the tests that care.
  mockWindow.mockResolvedValue({ ...DEFAULT_WINDOW, enabled: false })
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
    // The wording is built by lib/automation-email from the rule's template, so
    // what arrives here is a finished email. Check it names the right document
    // and greets the right person.
    expect(arg.subject).toContain("1 new filing")
    expect(arg.text).toContain("Dear Culix,")
    expect(arg.html).toContain("2026.09.01 Motion")
    expect(arg.html).toContain(">Click here</a>")
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
    // Named, not just counted: a silent counter is what hid a malformed base id
    // for a whole afternoon.
    expect(out["new-pleading"].errors[0]).toContain("Gichana")
    expect(out["new-pleading"].errors[0]).toContain("Pleadings board")
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

  it("names a client who has no base id at all", async () => {
    mockClients.mockResolvedValue([{ ...CLIENT, clientBaseId: "" }])
    mockListRules.mockResolvedValue(rule())

    const out = await runAutomations()

    expect(out["new-pleading"].errors[0]).toContain("no Airtable base id")
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

  // ---- the rules added on 2026-09-04 -------------------------------------

  function oneRule(over: Record<string, unknown>) {
    return [
      {
        key: "r",
        label: "R",
        description: "",
        noun: "update",
        enabled: true,
        mode: "auto",
        subject: DEFAULT_SUBJECT,
        body: DEFAULT_BODY,
        ...over,
      },
    ]
  }

  it("discovery only ever reads rows already released to the client", async () => {
    mockListRules.mockResolvedValue(
      oneRule({ kind: "documents", board: "discovery", noun: "discovery item" })
    )
    mockHasSeen.mockResolvedValue(true)
    mockDiscovery.mockResolvedValue([
      { id: "recD1", title: "RPD responses", date: "2026-09-01", direction: "", tags: [], notes: "", link: "https://drive.google.com/x" },
    ])

    await runAutomations()

    // lib/discovery filters on "Avail. to Client" before we ever see a row, so
    // the guarantee is that this rule reads that function and nothing else.
    expect(mockDiscovery).toHaveBeenCalledWith("appClientBase")
    expect(mockPleadings).not.toHaveBeenCalled()
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it("status reads the client-facing column and tells the client when it changes", async () => {
    mockListRules.mockResolvedValue(oneRule({ kind: "status" }))
    mockHasSeen.mockResolvedValue(true)
    mockStatuses.mockResolvedValue([
      { recordId: "recClient1", statusText: "Waiting on a hearing date", internalText: "chase the clerk" },
    ])

    await runAutomations()

    const arg = mockSend.mock.calls[0][0]
    expect(arg.text).toContain("Waiting on a hearing date")
    // The firm's own note must never reach the client.
    expect(arg.text).not.toContain("chase the clerk")
    expect(arg.html).not.toContain("chase the clerk")
  })

  it("refuses to run the status rule at all if the status board comes back empty", async () => {
    mockListRules.mockResolvedValue(oneRule({ kind: "status" }))
    mockStatuses.mockResolvedValue([])

    const out = await runAutomations()

    // An empty read is a failure, not "every client's status is blank".
    expect(out["r"].ran).toBe(false)
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockMarkSeen).not.toHaveBeenCalled()
  })

  it("reminds about a court date a week out and again the day before, once each", async () => {
    mockListRules.mockResolvedValue(oneRule({ kind: "hearing", noun: "court date" }))
    mockHasSeen.mockResolvedValue(true)
    const inFiveDays = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    mockEvents.mockResolvedValue([
      { id: "ev1", title: "Temporary hearing", start: inFiveDays, location: "Courtroom 3B", eventLink: "https://calendar.google.com/x", status: "confirmed" },
    ])

    await runAutomations()

    const arg = mockSend.mock.calls[0][0]
    expect(arg.text).toContain("Temporary hearing")
    expect(arg.text).toContain("Courtroom 3B")
    // The week reminder and the day reminder are separate items, so the day
    // one can still fire later without the week one repeating.
    expect(mockMarkSeen).toHaveBeenCalledWith("r", "recClient1", ["ev1:week"])
  })

  it("ignores a court date that has already happened, and a cancelled one", async () => {
    mockListRules.mockResolvedValue(oneRule({ kind: "hearing", noun: "court date" }))
    mockHasSeen.mockResolvedValue(true)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const tomorrow = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    mockEvents.mockResolvedValue([
      { id: "old", title: "Past", start: yesterday, location: "", eventLink: "", status: "confirmed" },
      { id: "off", title: "Cancelled", start: tomorrow, location: "", eventLink: "", status: "cancelled" },
    ])

    await runAutomations()

    expect(mockSend).not.toHaveBeenCalled()
  })

  it("does not nudge a client who signed in recently", async () => {
    mockListRules.mockResolvedValue(oneRule({ kind: "dormant", noun: "reminder" }))
    mockHasSeen.mockResolvedValue(true)
    const { sql } = jest.requireMock("@/lib/db") as { sql: jest.Mock }
    sql.mockResolvedValue({
      rows: [{ email: "client@example.com", last: new Date().toISOString() }],
    })

    await runAutomations()

    expect(mockSend).not.toHaveBeenCalled()
  })

  it("nudges a client who has been away longer than the limit", async () => {
    mockListRules.mockResolvedValue(oneRule({ kind: "dormant", noun: "reminder" }))
    mockHasSeen.mockResolvedValue(true)
    const longAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { sql } = jest.requireMock("@/lib/db") as { sql: jest.Mock }
    sql.mockResolvedValue({ rows: [{ email: "client@example.com", last: longAgo }] })

    await runAutomations()

    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend.mock.calls[0][0].text).toContain("90 days")
  })

  it("refuses to run the dormant rule if sign-in history comes back empty", async () => {
    mockListRules.mockResolvedValue(oneRule({ kind: "dormant", noun: "reminder" }))
    const { sql } = jest.requireMock("@/lib/db") as { sql: jest.Mock }
    sql.mockResolvedValue({ rows: [] })

    const out = await runAutomations()

    // Otherwise every client looks like they have never been back, and the
    // whole roster gets nudged at once.
    expect(out["r"].ran).toBe(false)
    expect(mockSend).not.toHaveBeenCalled()
  })

  // ---- sending hours ------------------------------------------------------

  it("does nothing at all outside the sending hours, and marks nothing as seen", async () => {
    mockWindow.mockResolvedValue(DEFAULT_WINDOW) // weekdays 8-4
    jest.useFakeTimers().setSystemTime(new Date("2026-09-06T03:00:00Z")) // Sat 11pm ET
    mockListRules.mockResolvedValue(rule())
    mockHasSeen.mockResolvedValue(true)
    mockPleadings.mockResolvedValue(docs(1))

    const out = await runAutomations()
    jest.useRealTimers()

    expect(mockSend).not.toHaveBeenCalled()
    expect(mockEnqueue).not.toHaveBeenCalled()
    // Nothing read and nothing recorded, which is what makes the document still
    // count as new on Monday morning. If it were marked seen here the client
    // would never be told about it at all.
    expect(mockMarkSeen).not.toHaveBeenCalled()
    expect(mockPleadings).not.toHaveBeenCalled()
    expect(out["new-pleading"].ran).toBe(false)
    expect(out["new-pleading"].reason).toMatch(/Outside sending hours/)
  })

  it("sends the held document once the hours open", async () => {
    mockWindow.mockResolvedValue(DEFAULT_WINDOW)
    jest.useFakeTimers().setSystemTime(new Date("2026-09-07T14:00:00Z")) // Mon 10am ET
    mockListRules.mockResolvedValue(rule())
    mockHasSeen.mockResolvedValue(true)
    mockPleadings.mockResolvedValue(docs(1))

    const out = await runAutomations()
    jest.useRealTimers()

    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(out["new-pleading"].sent).toBe(1)
  })

  it("Check now can override the hours, because a person asked for it", async () => {
    mockWindow.mockResolvedValue(DEFAULT_WINDOW)
    jest.useFakeTimers().setSystemTime(new Date("2026-09-06T03:00:00Z")) // Sat 11pm ET
    mockListRules.mockResolvedValue(rule())
    mockHasSeen.mockResolvedValue(true)
    mockPleadings.mockResolvedValue(docs(1))

    await runAutomations({ ignoreWindow: true })
    jest.useRealTimers()

    expect(mockSend).toHaveBeenCalledTimes(1)
  })
})
