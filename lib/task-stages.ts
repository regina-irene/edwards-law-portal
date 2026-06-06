// Canonical stage order for the Family Law task board (LaunchBay-style).
export const TASK_STAGES = [
  "Onboarding",
  "Onboarding w/o children",
  "Discovery",
  "Case Prep Stage",
  "Mediation Prep",
  "Trial Prep",
  "Post Case",
] as const

export interface StageGroup<T> {
  stage: string
  stageOrder: number
  tasks: T[]
}

// Groups task rows by stage, ordering stages by stage_order and tasks by
// sort_order. Rows without a stage fall into an "Other" group at the end.
export function groupByStage<
  T extends { stage?: string | null; stage_order?: number; sort_order?: number }
>(rows: T[]): StageGroup<T>[] {
  const map = new Map<string, StageGroup<T>>()
  for (const r of rows) {
    const stage = r.stage || "Other"
    if (!map.has(stage)) {
      map.set(stage, { stage, stageOrder: r.stage_order ?? 999, tasks: [] })
    }
    map.get(stage)!.tasks.push(r)
  }
  const groups = [...map.values()].sort((a, b) => a.stageOrder - b.stageOrder)
  for (const g of groups) {
    g.tasks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }
  return groups
}
