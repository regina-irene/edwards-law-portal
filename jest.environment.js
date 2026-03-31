/**
 * Custom Jest environment that extends jsdom with Node.js fetch API globals.
 * Required because jsdom does not include Request/Response/fetch,
 * but Next.js API route handlers and their tests use these Web APIs.
 */
const JSDOMEnvironment = require("jest-environment-jsdom").default

class FetchJSDOMEnvironment extends JSDOMEnvironment {
  async setup() {
    await super.setup()
    // Inject Node.js 18+ built-in fetch globals into the jsdom global scope
    if (typeof this.global.Request === "undefined") {
      this.global.Request = globalThis.Request
    }
    if (typeof this.global.Response === "undefined") {
      this.global.Response = globalThis.Response
    }
    if (typeof this.global.Headers === "undefined") {
      this.global.Headers = globalThis.Headers
    }
    if (typeof this.global.fetch === "undefined") {
      this.global.fetch = globalThis.fetch
    }
  }
}

module.exports = FetchJSDOMEnvironment
