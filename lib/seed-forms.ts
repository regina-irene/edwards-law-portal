// lib/seed-forms.ts - forms the firm supplied as paper or HTML, turned into
// portal forms clients can fill in (2026-08-22).
//
// These are seeded into `portal_forms` on first use rather than shipped as
// hard-coded pages, which matters: once seeded, a form is an ORDINARY ROW. It
// shows up in the Form Builder, every question can be renamed, reordered or
// deleted there, and the changes stick. Nothing here overwrites it afterwards.
//
// Seeding is one-shot per form key. If the key already exists - because it was
// seeded before, or because it has since been edited - it is left alone. So a
// deploy can never quietly undo an edit.
import { sql } from "@/lib/db"
import type { FormDefinition, FormField, FormSection } from "@/lib/portal-forms"

/** Terser than writing the full field shape out forty times. */
function field(
  section: string,
  position: number,
  label: string,
  opts: {
    type?: string
    width?: "full" | "half" | "third"
    help?: string
    options?: string[]
    required?: boolean
  } = {}
): FormField {
  const key = `${section}-${label}`
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return {
    id: key,
    fieldKey: key,
    label,
    scope: "client",
    type: opts.type ?? "text",
    placeholder: null,
    helpText: opts.help ?? null,
    required: opts.required ?? false,
    width: opts.width ?? "half",
    options: opts.options ? opts.options.map((o) => ({ value: o, label: o })) : null,
    position,
  }
}

function section(id: string, title: string, description: string | null, fields: FormField[], position: number): FormSection {
  return { id, title, description, position, fields }
}

/**
 * Service Information Sheet.
 *
 * Everything a process server needs to find and identify the respondent. Taken
 * from the firm's own sheet, question for question and in the same order, so a
 * client who has seen the paper version recognises it.
 *
 * Nothing is marked required. The sheet is often filled in over several
 * sittings and a client who does not know the respondent's work address should
 * still be able to save the twenty things they DO know - a required field would
 * just block the submit and lose the lot.
 */
const SERVICE_INFORMATION_SHEET: FormDefinition = {
  key: "service-information-sheet",
  label: "Service Information Sheet",
  description:
    "This helps the process server find and identify the other party. Fill in whatever you know - you can save and come back to it. Anything you cannot answer, leave blank.",
  sections: [
    section("client", "Your information", null, [
      field("client", 0, "Your name", { width: "half" }),
      field("client", 1, "Phone (home)", { type: "tel", width: "third" }),
      field("client", 2, "Phone (work)", { type: "tel", width: "third" }),
      field("client", 3, "Phone (cell)", { type: "tel", width: "third" }),
    ], 0),

    section("respondent", "The other party", "The person to be served.", [
      field("respondent", 0, "Their full name", { width: "half" }),
      field("respondent", 1, "Any other names they use", { width: "half", help: "Nicknames, maiden name, aliases." }),
      field("respondent", 2, "Home address", { type: "textarea", width: "full" }),
      field("respondent", 3, "What hours are they usually at home?", { width: "half" }),
      field("respondent", 4, "Where do they park at home?", { width: "half", help: "Driveway, street, numbered space in a garage." }),
      field("respondent", 5, "Phone (home)", { type: "tel", width: "third" }),
      field("respondent", 6, "Phone (work)", { type: "tel", width: "third" }),
      field("respondent", 7, "Phone (cell)", { type: "tel", width: "third" }),
      field("respondent", 8, "Email", { type: "email", width: "half" }),
    ], 1),

    section("employment", "Their employment", null, [
      field("employment", 0, "Business owner - company name", { width: "half" }),
      field("employment", 1, "Employee - company name", { width: "half" }),
      field("employment", 2, "Shift or usual working hours", { width: "half" }),
      field("employment", 3, "Work address, if known", { type: "textarea", width: "full" }),
    ], 2),

    section("relatives", "Relatives", "People who may know where they are.", [
      field("relatives", 0, "Name", { width: "half" }),
      field("relatives", 1, "Relation", { width: "half" }),
      field("relatives", 2, "Name (2)", { width: "half" }),
      field("relatives", 3, "Relation (2)", { width: "half" }),
      field("relatives", 4, "Name (3)", { width: "half" }),
      field("relatives", 5, "Relation (3)", { width: "half" }),
    ], 3),

    section("description", "Physical description", "So the server can be sure they have the right person.", [
      field("description", 0, "Height", { width: "third" }),
      field("description", 1, "Weight", { width: "third" }),
      field("description", 2, "Sex", { type: "radio", width: "third", options: ["Male", "Female"] }),
      field("description", 3, "Race", { width: "third" }),
      field("description", 4, "Eye colour", { width: "third" }),
      field("description", 5, "Hair colour and length", { width: "third" }),
      field("description", 6, "Glasses", { width: "third" }),
      field("description", 7, "Beard", { width: "third" }),
      field("description", 8, "Moustache", { width: "third" }),
      field("description", 9, "Scars", { width: "half" }),
      field("description", 10, "Tattoos", { width: "half" }),
      field("description", 11, "Anything else that would help identify them", { type: "textarea", width: "full" }),
    ], 4),

    section("social", "Social media", "Useful for confirming appearance and current whereabouts.", [
      field("social", 0, "Facebook", { width: "half" }),
      field("social", 1, "Instagram", { width: "half" }),
      field("social", 2, "TikTok", { width: "half" }),
      field("social", 3, "X / Twitter", { width: "half" }),
      field("social", 4, "LinkedIn", { width: "half" }),
      field("social", 5, "Other", { width: "half" }),
      field("social", 6, "Friends or colleagues they are often with", { type: "textarea", width: "full" }),
    ], 5),

    section("vehicle", "Vehicle", null, [
      field("vehicle", 0, "Year", { width: "third" }),
      field("vehicle", 1, "Make", { width: "third" }),
      field("vehicle", 2, "Model", { width: "third" }),
      field("vehicle", 3, "Colour", { width: "third" }),
      field("vehicle", 4, "Licence plate number", { width: "third" }),
      field("vehicle", 5, "Anything else about the vehicle", { width: "third" }),
    ], 6),

    section(
      "thoughts",
      "Your thoughts",
      // The warning from the paper sheet, kept where the client will actually
      // read it rather than in small print at the bottom.
      "Please do not discuss the possibility of being served with the other party. It often leads to them avoiding service, which delays your case and can cost you more.",
      [
        field("thoughts", 0, "Do you think they will try to avoid being served?", { type: "textarea", width: "full" }),
        field("thoughts", 1, "Do they drink or use drugs?", { type: "textarea", width: "full" }),
        field("thoughts", 2, "Could they be dangerous to the process server? Please explain.", {
          type: "textarea",
          width: "full",
          help: "Say so plainly if you have any concern. It affects how service is arranged.",
        }),
      ],
      7
    ),
  ],
}

const SEEDS: FormDefinition[] = [SERVICE_INFORMATION_SHEET]

/**
 * A task template per seeded form, so the form is assignable the moment it
 * exists rather than needing to be wired up on the Templates tab first.
 *
 * `form_key` is what makes a task open the form: the client sees the task on
 * their list, opens it, and fills the form in place.
 */
const TEMPLATE_SEEDS: { title: string; description: string; formKey: string; stage: string }[] = [
  {
    title: "Fill in the Service Information Sheet",
    description:
      "So the process server can find and identify the other party. Fill in whatever you know - you can save and come back to it.",
    formKey: "service-information-sheet",
    stage: "2 - Filed / Awaiting Service",
  },
]

let done: Promise<void> | undefined

/**
 * Insert any seed form that is not already there. Never updates or overwrites.
 *
 * Runs once per server instance and swallows its own errors: a form that fails
 * to seed is a form that is missing from the list, not a page that fails to
 * load.
 */
export function seedForms(): Promise<void> {
  if (done) return done
  done = (async () => {
    for (const def of SEEDS) {
      try {
        await sql`
          INSERT INTO portal_forms (key, label, description, definition, source, stage, updated_at)
          VALUES (${def.key}, ${def.label}, ${def.description}, ${JSON.stringify(def)}, 'seed', NULL, NOW())
          ON CONFLICT (key) DO NOTHING
        `
      } catch (e) {
        console.error(`[seed-forms] ${def.key} failed:`, e instanceof Error ? e.message : e)
      }
    }

    for (const t of TEMPLATE_SEEDS) {
      try {
        // Matched on title so this cannot pile up duplicates on every restart,
        // and so a template Regina has renamed is left alone rather than
        // re-created alongside her version.
        await sql`
          INSERT INTO task_templates (title, description, stage, form_key, stage_order, sort_order)
          SELECT ${t.title}, ${t.description}, ${t.stage}, ${t.formKey}, 0, 0
          WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = ${t.title})
        `
      } catch (e) {
        console.error(`[seed-forms] template ${t.title} failed:`, e instanceof Error ? e.message : e)
      }
    }
  })()
  return done
}
