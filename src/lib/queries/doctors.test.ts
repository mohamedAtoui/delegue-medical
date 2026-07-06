import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Territory scoping guard: a délégué must only see médecins/pharmaciens in their
 * assigned wilayas. fetchDoctors enforces this by adding `.in("wilaya", ...)`
 * when `restrictWilayas` is set — except for grossistes, which are national.
 */

interface InCall {
  column: string;
  values: unknown;
}
const inCalls: InCall[] = [];
const eqCalls: InCall[] = [];
const orCalls: string[] = [];

function builder() {
  const b: Record<string, unknown> = {};
  const chain = ["select", "eq", "in", "or", "order", "range", "limit"];
  for (const m of chain) {
    b[m] = vi.fn((arg?: unknown, arg2?: unknown) => {
      if (m === "in") inCalls.push({ column: arg as string, values: arg2 });
      if (m === "eq") eqCalls.push({ column: arg as string, values: arg2 });
      if (m === "or") orCalls.push(arg as string);
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
  inCalls.length = 0;
  eqCalls.length = 0;
  orCalls.length = 0;
});

describe("fetchDoctors territory scoping", () => {
  it("restricts médecins to the délégué's wilayas", async () => {
    const { fetchDoctors } = await import("./doctors");
    await fetchDoctors({ type: "medecin", restrictWilayas: ["Alger", "Blida"] });

    const wilayaIn = inCalls.find((c) => c.column === "wilaya");
    expect(wilayaIn).toBeTruthy();
    expect(wilayaIn?.values).toEqual(["Alger", "Blida"]);
  });

  it("does NOT restrict grossiste queries (national wholesalers)", async () => {
    const { fetchDoctors } = await import("./doctors");
    await fetchDoctors({ type: "grossiste", restrictWilayas: ["Alger"] });

    expect(inCalls.find((c) => c.column === "wilaya")).toBeUndefined();
  });

  it("applies no territory filter for supervisors (restrictWilayas null)", async () => {
    const { fetchDoctors } = await import("./doctors");
    await fetchDoctors({ type: "medecin", restrictWilayas: null });

    expect(inCalls.find((c) => c.column === "wilaya")).toBeUndefined();
  });

  it("keeps ALL grossistes visible in the combined view (type null)", async () => {
    const { fetchDoctors } = await import("./doctors");
    await fetchDoctors({ type: null, restrictWilayas: ["Alger"] });

    // No hard wilaya filter that would hide out-of-region grossistes...
    expect(inCalls.find((c) => c.column === "wilaya")).toBeUndefined();
    // ...instead an OR that always includes grossistes.
    const territoryOr = orCalls.find((o) => o.includes("doctor_type.eq.grossiste"));
    expect(territoryOr).toBeTruthy();
    expect(territoryOr).toContain('wilaya.in.("Alger")');
  });
});
