import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("config — SUPERVISOR_EMAILS / isSupervisorEmail", () => {
  const ORIGINAL = process.env.SUPERVISOR_EMAILS;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.SUPERVISOR_EMAILS;
    else process.env.SUPERVISOR_EMAILS = ORIGINAL;
  });

  it("falls back to baked-in defaults when env var missing", async () => {
    delete process.env.SUPERVISOR_EMAILS;
    const { SUPERVISOR_EMAILS, isSupervisorEmail } = await import("./config");
    expect(SUPERVISOR_EMAILS).toContain("attaimen40@gmail.com");
    expect(isSupervisorEmail("attaimen40@gmail.com")).toBe(true);
  });

  it("parses a comma-separated env var", async () => {
    process.env.SUPERVISOR_EMAILS = " a@x.com , b@y.com ,c@z.com ";
    const { SUPERVISOR_EMAILS } = await import("./config");
    expect(SUPERVISOR_EMAILS).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
  });

  it("matches case-insensitively", async () => {
    process.env.SUPERVISOR_EMAILS = "Boss@Example.Com";
    const { isSupervisorEmail } = await import("./config");
    expect(isSupervisorEmail("BOSS@example.com")).toBe(true);
    expect(isSupervisorEmail("boss@example.com")).toBe(true);
  });

  it("returns false for null/undefined/empty", async () => {
    process.env.SUPERVISOR_EMAILS = "a@b.com";
    const { isSupervisorEmail } = await import("./config");
    expect(isSupervisorEmail(null)).toBe(false);
    expect(isSupervisorEmail(undefined)).toBe(false);
    expect(isSupervisorEmail("")).toBe(false);
  });

  it("returns false for non-supervisor email", async () => {
    process.env.SUPERVISOR_EMAILS = "boss@example.com";
    const { isSupervisorEmail } = await import("./config");
    expect(isSupervisorEmail("random@gmail.com")).toBe(false);
  });

  it("ignores empty entries from trailing commas", async () => {
    process.env.SUPERVISOR_EMAILS = "a@x.com,,b@y.com,";
    const { SUPERVISOR_EMAILS } = await import("./config");
    expect(SUPERVISOR_EMAILS).toEqual(["a@x.com", "b@y.com"]);
  });
});
