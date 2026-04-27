import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeSupabase } from "../../../../tests/helpers/supabase-mock";
import { fakeDelegue, fakeSuperviseur } from "../../../../tests/helpers/auth-mock";

const mockGetOrCreateUser = vi.fn();
const mockCreateClient = vi.fn();
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));
vi.mock("@/lib/clerk/sync-user", () => ({ getOrCreateUser: () => mockGetOrCreateUser() }));

beforeEach(() => {
  mockGetOrCreateUser.mockReset();
  mockCreateClient.mockReset();
});

describe("/api/invitations GET", () => {
  it("rejects delegue", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("supervisor sees list with signed_up flag", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        invited_users: {
          data: [{ id: "i1", email: "a@x.com" }, { id: "i2", email: "b@x.com" }],
          error: null,
        },
        users: { data: [{ email: "a@x.com" }], error: null },
      })
    );
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].signed_up).toBe(true);
    expect(body[1].signed_up).toBe(false);
  });
});

describe("/api/invitations POST", () => {
  it("rejects delegue", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/invitations", {
        method: "POST",
        json: { email: "x@y.com" },
      }) as never
    );
    expect(res.status).toBe(403);
  });

  it("rejects invalid email", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/invitations", {
        method: "POST",
        json: { email: "not-an-email" },
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 on duplicate", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        invited_users: { data: { id: "i1" }, error: null },
      })
    );
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/invitations", {
        method: "POST",
        json: { email: "dup@x.com" },
      }) as never
    );
    expect(res.status).toBe(409);
  });

  it("supervisor can create invitation", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        invited_users: [
          { data: null, error: null }, // duplicate check → none
          { data: { id: "i1", email: "new@x.com" }, error: null }, // insert
        ],
      })
    );
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/invitations", {
        method: "POST",
        json: { email: "NEW@X.com" },
      }) as never
    );
    expect(res.status).toBe(200);
  });
});
