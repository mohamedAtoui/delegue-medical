import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabase } from "../../../../../tests/helpers/supabase-mock";
import { fakeDelegue } from "../../../../../tests/helpers/auth-mock";

const mockGetOrCreateUser = vi.fn();
const mockCreateClient = vi.fn();
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));
vi.mock("@/lib/clerk/sync-user", () => ({ getOrCreateUser: () => mockGetOrCreateUser() }));

beforeEach(() => {
  mockGetOrCreateUser.mockReset();
  mockCreateClient.mockReset();
});

describe("/api/notifications/mark-all-read POST", () => {
  it("rejects unauthenticated", async () => {
    mockGetOrCreateUser.mockResolvedValue(null);
    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("marks every unread row read for the current user", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    mockCreateClient.mockResolvedValue(
      makeSupabase({ notifications: { data: null, error: null } })
    );
    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(200);
  });
});
