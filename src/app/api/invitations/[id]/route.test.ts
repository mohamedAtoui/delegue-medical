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

describe("/api/invitations/[id] DELETE", () => {
  it("rejects delegue", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/invitations/i1") as never,
      makeContext({ id: "i1" }) as never
    );
    expect(res.status).toBe(403);
  });

  it("supervisor can delete", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({ invited_users: { data: null, error: null } })
    );
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/invitations/i1") as never,
      makeContext({ id: "i1" }) as never
    );
    expect(res.status).toBe(200);
  });
});
