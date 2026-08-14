import {
  taskState,
  daysUntil,
  progressFor,
  sortProgress,
  stageAccent,
  matchesSearch,
  type AssignedTask,
} from "@/lib/task-progress"

const TODAY = "2026-08-14"

const task = (over: Partial<AssignedTask> = {}): AssignedTask => ({
  id: "t1",
  client_id: "rec1",
  title: "Send bank statements",
  status: "pending",
  due_date: null,
  stage: "Discovery",
  tag: null,
  ...over,
})

describe("daysUntil", () => {
  it("counts calendar days, not timezone-shifted instants", () => {
    expect(daysUntil("2026-08-20", TODAY)).toBe(6)
    expect(daysUntil("2026-08-14T00:00:00.000Z", TODAY)).toBe(0)
    expect(daysUntil("2026-08-10", TODAY)).toBe(-4)
  })
  it("is null with no due date", () => {
    expect(daysUntil(null, TODAY)).toBeNull()
  })
})

describe("taskState", () => {
  it("calls a finished task done even when it's past due", () => {
    expect(taskState(task({ status: "done", due_date: "2026-01-01" }), TODAY)).toBe("done")
  })
  it("flags a past due date as overdue", () => {
    expect(taskState(task({ due_date: "2026-08-13" }), TODAY)).toBe("overdue")
  })
  it("treats today as due soon, not overdue", () => {
    expect(taskState(task({ due_date: "2026-08-14" }), TODAY)).toBe("soon")
  })
  it("calls the next seven days due soon", () => {
    expect(taskState(task({ due_date: "2026-08-21" }), TODAY)).toBe("soon")
    expect(taskState(task({ due_date: "2026-08-22" }), TODAY)).toBe("open")
  })
  it("is just open with no due date", () => {
    expect(taskState(task(), TODAY)).toBe("open")
  })
})

describe("progressFor", () => {
  it("counts done, overdue and due-this-week", () => {
    const p = progressFor("rec1", "Grey, C", [
      task({ id: "a", status: "done" }),
      task({ id: "b", due_date: "2026-08-01" }),
      task({ id: "c", due_date: "2026-08-16" }),
      task({ id: "d" }),
    ], TODAY)
    expect(p.total).toBe(4)
    expect(p.done).toBe(1)
    expect(p.overdue).toBe(1)
    expect(p.dueThisWeek).toBe(1)
    expect(p.percent).toBe(25)
    expect(p.worstOverdueDays).toBe(13)
  })
  it("reports 0% rather than dividing by zero", () => {
    expect(progressFor("rec1", "Grey, C", [], TODAY).percent).toBe(0)
  })
})

describe("sortProgress", () => {
  it("puts the most overdue client first, then sorts by name", () => {
    const a = progressFor("r1", "Alpha", [task({ due_date: "2026-08-13" })], TODAY)
    const b = progressFor("r2", "Beta", [task({ due_date: "2026-07-01" })], TODAY)
    const c = progressFor("r3", "Camden", [task()], TODAY)
    const d = progressFor("r4", "Ashby", [task()], TODAY)
    expect(sortProgress([a, c, b, d]).map((p) => p.label)).toEqual(["Beta", "Alpha", "Ashby", "Camden"])
  })
})

describe("stageAccent", () => {
  it("gives a stable colour per stage and wraps for new stages", () => {
    expect(stageAccent(0)).toBe(stageAccent(0))
    expect(stageAccent(0)).not.toBe(stageAccent(1))
    expect(stageAccent(7)).toBe(stageAccent(0))
  })
})

describe("matchesSearch", () => {
  it("matches a substring anywhere, case-insensitively", () => {
    expect(matchesSearch("bank", "Send bank statements", null)).toBe(true)
    expect(matchesSearch("BANK", "Send bank statements")).toBe(true)
    expect(matchesSearch("mediation", "Send bank statements")).toBe(false)
  })
  it("matches everything when the box is empty", () => {
    expect(matchesSearch("  ", "anything")).toBe(true)
  })
})
