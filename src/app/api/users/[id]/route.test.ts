import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeContext, makeRequest, makeSupabase } from "../../../../../tests/helpers/supabase-mock";
import { fakeDelegue, fakeSuperviseur } from "../../../../../tests/helpers/auth-mock";

const mockGetOrCreateUser = vi.fn();
const mockCreateClient = vi.fn();
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));
vi.mock("@/lib/clerk/sync-user", () => ({ getOrCreateUser: () => mockGetOrCreateUser() }));

beforeEach(() => {
  mockGetOrCreateUser.mockReset();
  mockCreateClient.mockReset();
});

describe("/api/users/[id] PATCH", () => {
  it("rejects unauthenticated", async () => {
    mockGetOrCreateUser.mockResolvedValue(null);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/users/u1", { method: "PATCH", json: {} }) as never,
      makeContext({ id: "u1" }) as never
    );
    expect(res.status).toBe(401);
  });

  it("rejects delegue", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/users/u1", {
        method: "PATCH",
        json: { daily_visit_goal: 5 },
      }) as never,
      makeContext({ id: "u1" }) as never
    );
    expect(res.status).toBe(403);
  });

  it("rejects empty patch", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/users/u1", { method: "PATCH", json: {} }) as never,
      makeContext({ id: "u1" }) as never
    );
    expect(res.status).toBe(400);
  });

  it("rejects out-of-range daily_visit_goal", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/users/u1", {
        method: "PATCH",
        json: { daily_visit_goal: 999 },
      }) as never,
      makeContext({ id: "u1" }) as never
    );
    expect(res.status).toBe(400);
  });

  it("supervisor can set goal", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        users: { data: { id: "u1", daily_visit_goal: 8 }, error: null },
      })
    );
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/users/u1", {
        method: "PATCH",
        json: { daily_visit_goal: 8 },
      }) as never,
      makeContext({ id: "u1" }) as never
    );
    expect(res.status).toBe(200);
  });
});
