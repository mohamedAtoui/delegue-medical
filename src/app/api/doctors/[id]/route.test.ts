import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeContext, makeRequest, makeSupabase } from "../../../../../tests/helpers/supabase-mock";
import { fakeDelegue, fakeSuperviseur } from "../../../../../tests/helpers/auth-mock";

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

describe("/api/doctors/[id] GET", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await import("./route");
    const res = await GET(
      makeRequest("http://x/api/doctors/d1") as never,
      makeContext({ id: "d1" }) as never
    );
    expect(res.status).toBe(401);
  });

  it("returns the doctor", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockCreateClient.mockResolvedValue(
      makeSupabase({ doctors: { data: { id: "d1" }, error: null } })
    );
    const { GET } = await import("./route");
    const res = await GET(
      makeRequest("http://x/api/doctors/d1") as never,
      makeContext({ id: "d1" }) as never
    );
    expect(res.status).toBe(200);
  });
});

describe("/api/doctors/[id] PUT", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { PUT } = await import("./route");
    const res = await PUT(
      makeRequest("http://x/api/doctors/d1", { method: "PUT", json: {} }) as never,
      makeContext({ id: "d1" }) as never
    );
    expect(res.status).toBe(401);
  });

  it("requires first_name/last_name/wilaya", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    const { PUT } = await import("./route");
    const res = await PUT(
      makeRequest("http://x/api/doctors/d1", {
        method: "PUT",
        json: { first_name: "x" },
      }) as never,
      makeContext({ id: "d1" }) as never
    );
    expect(res.status).toBe(400);
  });
});

describe("/api/doctors/[id] DELETE", () => {
  it("rejects unauthenticated", async () => {
    mockGetOrCreateUser.mockResolvedValue(null);
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/doctors/d1") as never,
      makeContext({ id: "d1" }) as never
    );
    expect(res.status).toBe(401);
  });

  it("rejects delegue", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/doctors/d1") as never,
      makeContext({ id: "d1" }) as never
    );
    expect(res.status).toBe(403);
  });

  it("supervisor can delete", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({ doctors: { data: null, error: null } })
    );
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/doctors/d1") as never,
      makeContext({ id: "d1" }) as never
    );
    expect(res.status).toBe(200);
  });
});
