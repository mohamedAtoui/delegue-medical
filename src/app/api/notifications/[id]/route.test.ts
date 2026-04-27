import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeContext, makeRequest, makeSupabase } from "../../../../../tests/helpers/supabase-mock";
import { fakeDelegue } from "../../../../../tests/helpers/auth-mock";

const mockGetOrCreateUser = vi.fn();
const mockCreateClient = vi.fn();
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));
vi.mock("@/lib/clerk/sync-user", () => ({ getOrCreateUser: () => mockGetOrCreateUser() }));

beforeEach(() => {
  mockGetOrCreateUser.mockReset();
  mockCreateClient.mockReset();
});

describe("/api/notifications/[id] PATCH", () => {
  it("rejects unauthenticated", async () => {
    mockGetOrCreateUser.mockResolvedValue(null);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/notifications/n1", { method: "PATCH", json: {} }) as never,
      makeContext({ id: "n1" }) as never
    );
    expect(res.status).toBe(401);
  });

  it("default behavior is mark-as-read", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    mockCreateClient.mockResolvedValue(
      makeSupabase({ notifications: { data: { id: "n1", read: true }, error: null } })
    );
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/notifications/n1", { method: "PATCH", json: {} }) as never,
      makeContext({ id: "n1" }) as never
    );
    expect(res.status).toBe(200);
  });
});

describe("/api/notifications/[id] DELETE", () => {
  it("rejects unauthenticated", async () => {
    mockGetOrCreateUser.mockResolvedValue(null);
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/notifications/n1") as never,
      makeContext({ id: "n1" }) as never
    );
    expect(res.status).toBe(401);
  });

  it("deletes own notification", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    mockCreateClient.mockResolvedValue(
      makeSupabase({ notifications: { data: null, error: null } })
    );
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/notifications/n1") as never,
      makeContext({ id: "n1" }) as never
    );
    expect(res.status).toBe(200);
  });
});
