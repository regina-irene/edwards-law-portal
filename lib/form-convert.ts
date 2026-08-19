// lib/form-convert.ts - turn a PDF or pasted text of a paper form into the
// portal's form definition, using Claude with a strict output schema so the
// result is always shaped correctly rather than "usually JSON".
import Anthropic from "@anthropic-ai/sdk"
import { normalizeDefinition, FIELD_TYPES, type FormDefinition } from "@/lib/portal-forms"

// Claude must answer in exactly this shape. Structured outputs enforce it, so
// there is no JSON parsing to defend against.
const FORM_SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string", description: "A short title for the form, e.g. 'Client Information'" },
    description: { type: "string", description: "One sentence telling the client what the form is for. Empty string if the document gives no useful summary." },
    sections: {
      type: "array",
      description: "The form's sections, in document order. Use one section per heading in the document; a form with no headings gets a single section.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string", description: "Instructions printed under the heading; empty string if none." },
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "The question exactly as a client would read it." },
                type: { type: "string", enum: [...FIELD_TYPES] },
                helpText: { type: "string", description: "Any instruction, example, or clarification printed with the question; empty string if none." },
                required: { type: "boolean", description: "True only when the document marks it required (asterisk, 'required', 'must')." },
                width: { type: "string", enum: ["full", "half"], description: "'half' for short answers like first name, city, state, zip; 'full' otherwise." },
                options: {
                  type: "array",
                  description: "The choices, for select and radio only. Empty array for every other type.",
                  items: {
                    type: "object",
                    properties: { label: { type: "string" } },
                    required: ["label"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["label", "type", "helpText", "required", "width", "options"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "description", "fields"],
        additionalProperties: false,
      },
    },
  },
  required: ["label", "sections"],
  additionalProperties: false,
} as const

const SYSTEM = `You convert paper and PDF forms used by a family law firm into online forms its clients fill in.

Read the document and reproduce every question a client is expected to answer, in the order they appear.

- Keep the firm's own wording for each question. Don't reword, merge, or improve questions.
- One field per answer the client writes. A line asking for "Name of child and date of birth" is two fields.
- Choose the field type from what the answer is: date for dates, email for email addresses, tel for phone numbers, number for counts, currency for money amounts, select or radio when the form prints a fixed set of choices, checkbox for a single yes/no or acknowledgement, textarea where the form leaves several lines for an explanation, otherwise text.
- Mark a field required only when the document itself marks it required.
- Skip anything that is not a question for the client: page numbers, headers and footers, signature blocks, notary blocks, attorney-use-only sections, and instructions that ask for nothing.
- If the document contains no answerable questions at all, return a form with an empty sections array.`

export interface ConvertResult {
  definition: FormDefinition
  fieldCount: number
}

interface RawForm {
  label: string
  description?: string
  sections: {
    title: string
    description?: string
    fields: {
      label: string
      type: string
      helpText?: string
      required?: boolean
      width?: string
      options?: { label: string }[]
    }[]
  }[]
}

export function conversionConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

// `key` is the form key the definition will be stored under; `pdfBase64` and
// `text` are alternatives - exactly one is used.
export async function convertToForm(opts: {
  key: string
  labelHint?: string
  text?: string
  pdfBase64?: string
}): Promise<ConvertResult> {
  const client = new Anthropic()

  const instruction = opts.labelHint
    ? `Convert this into an online form. The firm calls it "${opts.labelHint}".`
    : "Convert this into an online form."

  const content: Anthropic.ContentBlockParam[] = opts.pdfBase64
    ? [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: opts.pdfBase64 } },
        { type: "text", text: instruction },
      ]
    : [{ type: "text", text: `${instruction}\n\nHere is the form:\n\n${opts.text ?? ""}` }]

  // Streaming: a long intake form can run to many thousands of tokens, and a
  // non-streaming request that size risks an HTTP timeout.
  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 32000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: FORM_SCHEMA } },
    messages: [{ role: "user", content }],
  })
  const message = await stream.finalMessage()

  if (message.stop_reason === "refusal") {
    throw new Error("The document couldn't be converted.")
  }

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
  if (!text.trim()) throw new Error("The conversion came back empty.")

  const raw = JSON.parse(text) as RawForm
  const definition = normalizeDefinition(
    opts.key,
    (opts.labelHint || raw.label || "Untitled form").trim(),
    raw.description?.trim() || null,
    raw.sections ?? []
  )
  return { definition, fieldCount: definition.sections.reduce((n, s) => n + s.fields.length, 0) }
}
