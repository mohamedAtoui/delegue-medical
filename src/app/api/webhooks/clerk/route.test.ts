import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeSupabase } from "../../../../../tests/helpers/supabase-mock";

const mockCreateAdminClient = vi.fn();
vi.mock("@/utils/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

beforeEach(() => {
  mockCreateAdminClient.mockReset();
  process.env.SUPERVISOR_EMAILS = "boss@example.com";
});

describe("/api/webhooks/clerk POST", () => {
  it("creates a delegue when invited email signs up", async () => {
    mockCreateAdminClient.mockReturnValue(
      makeSupabase({
        invited_users: { data: { id: "i1" }, error: null },
        users: { data: null, error: null },
      })
    );
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/webhooks/clerk", {
        method: "POST",
        json: {
          type: "user.created",
          data: {
            id: "clerk_new",
            email_addresses: [{ email_address: "invited@x.com" }],
            first_name: "I",
            last_name: "Nv",
          },
        },
      }) as never
    );
    expect(res.status).toBe(200);
  });

  it("skips creation for non-allowlisted email", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockCreateAdminClient.mockReturnValue(
      makeSupabase({
        invited_users: { data: null, error: null },
      })
    );
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/webhooks/clerk", {
        method: "POST",
        json: {
          type: "user.created",
          data: {
            id: "clerk_x",
            email_addresses: [{ email_address: "random@gmail.com" }],
            first_name: "R",
            last_name: "X",
          },
        },
      }) as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("creates supervisor for SUPERVISOR_EMAILS bypass", async () => {
    process.env.SUPERVISOR_EMAILS = "boss@example.com";
    mockCreateAdminClient.mockReturnValue(
      makeSupabase({ users: { data: null, error: null } })
    );
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/webhooks/clerk", {
        method: "POST",
        json: {
          type: "user.created",
          data: {
            id: "clerk_boss",
            email_addresses: [{ email_address: "boss@example.com" }],
            first_name: "B",
            last_name: "Oss",
          },
        },
      }) as never
    );
    expect(res.status).toBe(200);
  });

  it("handles user.updated event", async () => {
    mockCreateAdminClient.mockReturnValue(
      makeSupabase({ users: { data: null, error: null } })
    );
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/webhooks/clerk", {
        method: "POST",
        json: {
          type: "user.updated",
          data: {
            id: "clerk_x",
            email_addresses: [{ email_address: "x@y.com" }],
            first_name: "X",
            last_name: "Y",
          },
        },
      }) as never
    );
    expect(res.status).toBe(200);
  });
});
