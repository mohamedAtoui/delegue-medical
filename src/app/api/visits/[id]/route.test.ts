import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabase, makeContext, makeRequest } from "../../../../../tests/helpers/supabase-mock";
import { fakeDelegue, fakeSuperviseur } from "../../../../../tests/helpers/auth-mock";

const mockGetOrCreateUser = vi.fn();
const mockCreateClient = vi.fn();
vi.mock("@/lib/clerk/sync-user", () => ({
  getOrCreateUser: () => mockGetOrCreateUser(),
}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

beforeEach(() => {
  mockGetOrCreateUser.mockReset();
  mockCreateClient.mockReset();
});

describe("/api/visits/[id] DELETE", () => {
  it("rejects unauthenticated", async () => {
    mockGetOrCreateUser.mockResolvedValue(null);
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/visits/v1") as never,
      makeContext({ id: "v1" }) as never
    );
    expect(res.status).toBe(401);
  });

  it("rejects delegue (supervisor only)", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/visits/v1") as never,
      makeContext({ id: "v1" }) as never
    );
    expect(res.status).toBe(403);
  });

  it("supervisor can delete: unlinks assignments and removes visit", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    const supabase = makeSupabase({
      visit_assignments: { data: null, error: null },
      visits: { data: null, error: null },
    });
    mockCreateClient.mockResolvedValue(supabase);
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/visits/v1") as never,
      makeContext({ id: "v1" }) as never
    );
    expect(res.status).toBe(200);
    // Confirm both side-effects: assignment unlink + visit delete
    const tables = supabase.from.mock.calls.map((c) => c[0]);
    expect(tables).toContain("visit_assignments");
    expect(tables).toContain("visits");
  });
});
