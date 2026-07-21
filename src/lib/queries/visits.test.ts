import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression guard: the visit_grossistes junction gives PostgREST a second
 * visits→doctors relationship, so the doctor embed MUST name the direct FK
 * (visits_doctor_id_fkey) or every visits query throws PGRST201. A bare
 * `doctor:doctors(` embed here would take the whole app (dashboard, /visites)
 * down again.
 */

const selectCalls: string[] = [];
const eqCalls: [string, unknown][] = [];

function builder() {
  const b: Record<string, unknown> = {};
  const chain = [
    "select", "eq", "in", "gte", "lte", "or", "order", "range", "limit",
  ];
  for (const m of chain) {
    b[m] = vi.fn((arg?: unknown, arg2?: unknown) => {
      if (m === "select" && typeof arg === "string") selectCalls.push(arg);
      if (m === "eq" && typeof arg === "string") eqCalls.push([arg, arg2]);
      return b;
    });
  }
  b.then = (onF: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], count: 0, error: null }).then(onF);
  return b;
}

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ from: vi.fn(() => builder()) }),
}));

beforeEach(() => {
  selectCalls.length = 0;
  eqCalls.length = 0;
});

describe("fetchVisits doctor embed", () => {
  it("names the direct FK so the doctor embed is never ambiguous", async () => {
    const { fetchVisits } = await import("./visits");
    await fetchVisits({ all: true, page: 1, limit: 20 });

    const mainSelect = selectCalls.find((s) => s.includes("doctor:doctors"));
    expect(mainSelect).toBeTruthy();
    expect(mainSelect).toContain("doctor:doctors!visits_doctor_id_fkey");
    // No bare, ambiguous embed.
    expect(mainSelect).not.toMatch(/doctor:doctors\(/);
  });

  it("keeps the FK hint when an inner join is needed (wilaya/search)", async () => {
    const { fetchVisits } = await import("./visits");
    await fetchVisits({ all: true, search: "abc", page: 1, limit: 20 });

    const mainSelect = selectCalls.find((s) => s.includes("doctor:doctors"));
    expect(mainSelect).toContain("doctor:doctors!visits_doctor_id_fkey!inner");
  });
});

describe("fetchVisits commune filter", () => {
  it("filters on the embedded doctor commune with an inner join", async () => {
    const { fetchVisits } = await import("./visits");
    await fetchVisits({ all: true, commune: "Ain Arnat", page: 1, limit: 20 });

    // Inner join is required, otherwise PostgREST keeps visits whose doctor
    // doesn't match instead of excluding them.
    const mainSelect = selectCalls.find((s) => s.includes("doctor:doctors"));
    expect(mainSelect).toContain("doctor:doctors!visits_doctor_id_fkey!inner");
    expect(eqCalls).toContainEqual(["doctor.commune", "Ain Arnat"]);
  });

  it("does not filter by commune when none is given", async () => {
    const { fetchVisits } = await import("./visits");
    await fetchVisits({ all: true, page: 1, limit: 20 });
    expect(eqCalls.find(([col]) => col === "doctor.commune")).toBeUndefined();
  });
});
