// lib/ensure-columns.ts - add a missing column on first use, so shipping a
// feature never becomes a chore for the person running the firm (2026-08-22).
//
// WHY THIS EXISTS
// Recording WHO at the firm sent a message needed a new column on
// chat_messages. The project has a migration script for exactly this, but it is
// run from a terminal, and Regina is not a developer. Telling her to "run the
// migration" after every push is both jargon and a trap: forget it, and sending
// a message starts failing with a database error nobody on the firm's side can
// read or fix.
//
// So the column is added the first time the code needs it. `ADD COLUMN IF NOT
// EXISTS` is idempotent, the result is remembered for the life of the server
// instance, and a failure is swallowed rather than allowed to break the request
// that triggered it - the callers below all cope with the column being absent.
//
// This does NOT replace scripts/migrate.ts. That remains the place for anything
// structural: new tables, indexes, constraints, backfills. This is only for a
// single nullable column that the app can safely live without.
import { sql } from "@/lib/db"

/** One promise per column, so twenty concurrent requests do one ALTER. */
const pending = new Map<string, Promise<void>>()

function ensure(key: string, run: () => Promise<unknown>): Promise<void> {
  const existing = pending.get(key)
  if (existing) return existing
  const p = run()
    .then(() => undefined)
    .catch((e) => {
      // Losing this is survivable: the feature it enables degrades, the request
      // does not fail. Logged by name so it is greppable if it ever matters.
      console.error(`[ensure-columns] ${key} failed:`, e instanceof Error ? e.message : e)
    })
  pending.set(key, p)
  return p
}

/**
 * `chat_messages.author_email` - which admin sent a firm message.
 *
 * Null on every row written before this existed. We do not know who sent those
 * and will not guess, so the log keeps its old wording for them.
 */
export function ensureChatAuthorColumn(): Promise<void> {
  return ensure("chat_messages.author_email", () =>
    sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS author_email TEXT`
  )
}
