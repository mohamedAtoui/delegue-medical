import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeSupabase } from "../../../../tests/helpers/supabase-mock";
import { fakeDelegue, fakeSuperviseur } from "../../../../tests/helpers/auth-mock";

const mockAuth = vi.fn();
const mockGetOrCreateUser = vi.fn();
const mockCreateClient = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));
vi.mock("@/lib/clerk/sync-user", () => ({ getOrCreateUser: () => mockGetOrCreateUser() }));

beforeEach(() => {
  mockAuth.mockReset();
  mockGetOrCreateUser.mockReset();
  mockCreateClient.mockReset();
});

describe("/api/territories GET", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/territories") as never);
    expect(res.status).toBe(401);
  });

  it("returns assignments", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        territory_assignments: { data: [{ user_id: "u1", wilaya: "Alger" }], error: null },
      })
    );
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/territories") as never);
    expect(res.status).toBe(200);
  });
});

describe("/api/territories PUT", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { PUT } = await import("./route");
    const res = await PUT(
      makeRequest("http://x/api/territories", { method: "PUT", json: {} }) as never
    );
    expect(res.status).toBe(401);
  });

  it("rejects delegue", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { PUT } = await import("./route");
    const res = await PUT(
      makeRequest("http://x/api/territories", {
        method: "PUT",
        json: { user_id: "u1", wilayas: ["Alger"] },
      }) as never
    );
    expect(res.status).toBe(403);
  });

  it("requires user_id and wilayas array", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_s" });
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    const { PUT } = await import("./route");
    const res = await PUT(
      makeRequest("http://x/api/territories", {
        method: "PUT",
        json: { user_id: "u1" },
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("supervisor can update wilayas", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_s" });
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        users: { data: { id: "u_super" }, error: null },
        territory_assignments: { data: null, error: null },
      })
    );
    const { PUT } = await import("./route");
    const res = await PUT(
      makeRequest("http://x/api/territories", {
        method: "PUT",
        json: { user_id: "u1", wilayas: ["Alger", "Oran"] },
      }) as never
    );
    expect(res.status).toBe(200);
  });
});
