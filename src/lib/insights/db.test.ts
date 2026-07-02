import { describe, it, expect } from "vitest";
import { assertReadOnlySelect, UnsafeSqlError } from "./db";

describe("assertReadOnlySelect — SQL guard", () => {
  it("accepts a plain SELECT", () => {
    expect(assertReadOnlySelect("SELECT count(*) FROM visits")).toMatch(/^SELECT/i);
  });

  it("accepts a WITH ... SELECT (CTE)", () => {
    const sql = "WITH t AS (SELECT 1 AS n) SELECT n FROM t";
    expect(assertReadOnlySelect(sql)).toContain("SELECT n FROM t");
  });

  it("strips a single trailing semicolon", () => {
    expect(assertReadOnlySelect("SELECT 1;")).toBe("SELECT 1");
  });

  it.each([
    "INSERT INTO visits (id) VALUES ('x')",
    "UPDATE visits SET objective = 'x'",
    "DELETE FROM visits",
    "DROP TABLE visits",
    "ALTER TABLE visits ADD COLUMN x int",
    "TRUNCATE visits",
    "GRANT SELECT ON visits TO ai_ro",
    "CREATE TABLE x (id int)",
  ])("rejects non-SELECT: %s", (sql) => {
    expect(() => assertReadOnlySelect(sql)).toThrow(UnsafeSqlError);
  });

  it("rejects multiple statements", () => {
    expect(() => assertReadOnlySelect("SELECT 1; DELETE FROM visits")).toThrow(
      UnsafeSqlError
    );
  });

  it("rejects a forbidden keyword hidden in a comment-stripped payload", () => {
    // The DELETE is real (comment removed) -> still a second statement / keyword.
    expect(() =>
      assertReadOnlySelect("SELECT 1 /* harmless */ ; DROP TABLE visits")
    ).toThrow(UnsafeSqlError);
  });

  it("rejects an empty query", () => {
    expect(() => assertReadOnlySelect("   ")).toThrow(UnsafeSqlError);
  });
});
