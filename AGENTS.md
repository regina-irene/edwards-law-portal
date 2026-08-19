<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working with Regina

## Writing style
- **Never use em dashes**, in chat, in code comments, or in UI copy. Use a short
  dash, a colon, or split the sentence. This applies to subagents too: say so
  explicitly when delegating, because they default to the repo's older style.

## Offering choices
- When presenting options, **number them** (1, 2, 3) so they can be picked by
  number rather than retyped.

## Defaults on anything client-facing
- A new visibility or privacy control starts from **what clients already see
  today**, never from "everything on" and never from "everything off". The
  first switches internal data to clients; the second blanks working pages
  until it is configured.

## Deploying
- Regina commits and pushes herself. Do not run git commands or push.
- There is no local `node_modules`, so nothing compiles locally. Vercel's build
  is the only typecheck, and it has failed on TypeScript errors before. Review
  changes carefully before handing them over.
- `revalidateTag` in Next 16 takes TWO arguments: `revalidateTag(tag, { expire: 0 })`.
- Schema changes need `npm run migrate`, which is friction. Prefer the existing
  `app_settings` key/value table for small state.
