import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabase } from "../../../../tests/helpers/supabase-mock";
import { fakeDelegue } from "../../../../tests/helpers/auth-mock";

const mockGetOrCreateUser = vi.fn();
const mockCreateClient = vi.fn();
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));
vi.mock("@/lib/clerk/sync-user", () => ({ getOrCreateUser: () => mockGetOrCreateUser() }));
vi.mock("@/lib/notifications/create", () => ({
  createNotificationIfMissing: vi.fn(),
}));

beforeEach(() => {
  mockGetOrCreateUser.mockReset();
  mockCreateClient.mockReset();
});

describe("/api/notifications GET", () => {
  it("rejects unauthenticated", async () => {
    mockGetOrCreateUser.mockResolvedValue(null);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the user's notifications + unread_count", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        visit_assignments: { data: [], error: null },
        notifications: {
          data: [
            { id: "n1", read: false },
            { id: "n2", read: true },
          ],
          error: null,
        },
      })
    );
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unread_count).toBe(1);
    expect(body.data).toHaveLength(2);
  });
});
