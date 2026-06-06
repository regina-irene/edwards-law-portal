// Seeds the Family Law task templates, grouped into stages (LaunchBay layout).
// Run: node --env-file=.env.local scripts/seed-tasks.cjs
const { Pool } = require("pg")

const STAGES = [
  {
    name: "Onboarding",
    tasks: [
      ["Information needed - Divorce Complaint, contested with children", "Form"],
      ["Parenting Seminar (metro counties) - Please review information regarding parenting seminar", null],
      ["Information needed - Divorce Complaint, uncontested with children", "Form"],
      ["Invoice - please pay your invoice", null],
      ["Parenting Seminar (all counties) - Please review information regarding parenting seminar", null],
      ["Information needed - Divorce Answer, contested with children", "Form"],
      ["Contact information - Please complete the Contact Information form", "Form"],
    ],
  },
  {
    name: "Onboarding w/o children",
    tasks: [
      ["Information needed - Divorce complaint, uncontested without children", "Form"],
      ["Invoice - Please pay your invoice", null],
      ["Information needed - Divorce Answer, contested without children", "Form"],
      ["Information needed - Divorce Complaint, contested without children", "Form"],
    ],
  },
  {
    name: "Discovery",
    tasks: [
      ["Discovery requests from the other side - Please complete", null],
      ["Informal discovery requests from the other side - Please complete", null],
      ["DRFA (Domestic Relations Financial Affidavit) - Please complete your financial affidavit", null],
      ["Fulton Mandatory Discovery responses - Please complete", null],
    ],
  },
  {
    name: "Case Prep Stage",
    tasks: [
      ["Process server - Information needed for process server", "Form"],
      ["Zoom meeting with Regina - Please schedule your zoom strategy session w/ Regina", null],
      ["Drafts - Please review document drafts", null],
      ["Zoom meeting with Krista - Please schedule your zoom session with Krista", null],
      ["Status Conferences (Fulton County) - Please review information about status conferences", null],
    ],
  },
  {
    name: "Mediation Prep",
    tasks: [
      ["Mediation information - Please review / sign information about mediation", "Signature"],
      ["Documents needed from you - for Mediation", null],
      ["Zoom meeting with Regina to prepare for Mediation - Please schedule", null],
    ],
  },
  {
    name: "Trial Prep",
    tasks: [["Zoom meeting with Regina to prepare for Trial - Please schedule", null]],
  },
  {
    name: "Post Case",
    tasks: [
      ["Request for review, address for binder", null],
      ["Closing Letter - Withdrawal", null],
      ["Closing Letter - End of Case", null],
    ],
  },
]

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL_NON_POOLING,
    ssl: { rejectUnauthorized: false },
  })
  const client = await pool.connect()
  try {
    // Idempotent column adds (in case migrate hasn't run)
    await client.query(`
      ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS stage TEXT;
      ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS tag TEXT;
      ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS stage_order INT NOT NULL DEFAULT 0;
      ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
      ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS stage TEXT;
      ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS tag TEXT;
      ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS stage_order INT NOT NULL DEFAULT 0;
      ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
    `)

    await client.query("BEGIN")
    // Fresh master list (no client_tasks reference templates yet; FK is SET NULL anyway)
    await client.query("DELETE FROM task_templates")
    let stageOrder = 0
    let count = 0
    for (const stage of STAGES) {
      let sortOrder = 0
      for (const [title, tag] of stage.tasks) {
        await client.query(
          `INSERT INTO task_templates (title, description, stage, tag, stage_order, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [title, null, stage.name, tag, stageOrder, sortOrder]
        )
        sortOrder++
        count++
      }
      stageOrder++
    }
    await client.query("COMMIT")
    console.log(`Seeded ${count} task templates across ${STAGES.length} stages.`)
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {})
    throw e
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
