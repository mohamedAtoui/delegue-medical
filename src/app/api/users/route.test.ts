import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeSupabase } from "../../../../tests/helpers/supabase-mock";

const mockAuth = vi.fn();
const mockCreateClient = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));

beforeEach(() => {
  mockAuth.mockReset();
  mockCreateClient.mockReset();
});

describe("/api/users GET", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/users") as never);
    expect(res.status).toBe(401);
  });

  it("returns the current user when ?me=true", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        users: { data: { id: "u1", clerk_id: "clerk_d" }, error: null },
        visits: { data: [], error: null },
      })
    );
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/users?me=true") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("u1");
    expect(body.today_count).toBe(0);
  });

  it("returns 404 when ?me=true and user row missing", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_x" });
    mockCreateClient.mockResolvedValue(
      makeSupabase({ users: { data: null, error: null } })
    );
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/users?me=true") as never);
    expect(res.status).toBe(404);
  });

  it("returns list of users with role filter", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        users: { data: [{ id: "u1" }, { id: "u2" }], error: null },
        territory_assignments: { data: [], error: null },
      })
    );
    const { GET } = await import("./route");
    const res = await GET(
      makeRequest("http://x/api/users?role=delegue") as never
    );
    expect(res.status).toBe(200);
  });
});
