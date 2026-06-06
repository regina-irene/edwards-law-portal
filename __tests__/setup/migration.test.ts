/**
 * @jest-environment node
 */
// This test verifies the SQL strings contain all required tables (structure only)
// Actual migration runs against a real DB via `npm run migrate`
import { MIGRATION_SQL } from "@/scripts/migrate"

describe("migration SQL", () => {
  it("contains all required tables", () => {
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS users")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS accounts")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS sessions")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS verification_tokens")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS messages")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS chat_messages")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS nav_order")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS admin_users")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS client_labels")
  })
})
