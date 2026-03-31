// Polyfill Web Fetch API globals for jest-environment-jsdom
// Node.js 18+ provides these as built-in globals, but jsdom may clear them.
// We re-import from node:globals to ensure they are set.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeGlobals = require("node:globals") as typeof globalThis

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any
if (typeof g.Request === "undefined") g.Request = nodeGlobals.Request
if (typeof g.Response === "undefined") g.Response = nodeGlobals.Response
if (typeof g.Headers === "undefined") g.Headers = nodeGlobals.Headers
if (typeof g.fetch === "undefined") g.fetch = nodeGlobals.fetch
