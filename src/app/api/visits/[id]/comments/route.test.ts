import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeContext, makeRequest, makeSupabase } from "../../../../../../tests/helpers/supabase-mock";
import { fakeDelegue } from "../../../../../../tests/helpers/auth-mock";

const mockAuth = vi.fn();
const mockGetOrCreateUser = vi.fn();
const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockCreateNotifications = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: () => mockCreateAdminClient() }));
vi.mock("@/lib/clerk/sync-user", () => ({ getOrCreateUser: () => mockGetOrCreateUser() }));
vi.mock("@/lib/notifications/create", () => ({
  createNotifications: (...args: unknown[]) => mockCreateNotifications(...args),
}));

beforeEach(() => {
  mockAuth.mockReset();
  mockGetOrCreateUser.mockReset();
  mockCreateClient.mockReset();
  mockCreateAdminClient.mockReset();
  mockCreateNotifications.mockReset();
});

describe("/api/visits/[id]/comments GET", () => {
  it("returns 401 unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await import("./route");
    const res = await GET(
      makeRequest("http://x/api/visits/v1/comments") as never,
      makeContext({ id: "v1" }) as never
    );
    expect(res.status).toBe(401);
  });

  it("returns comments list", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        visit_comments: { data: [{ id: "c1" }], error: null },
      })
    );
    const { GET } = await import("./route");
    const res = await GET(
      makeRequest("http://x/api/visits/v1/comments") as never,
      makeContext({ id: "v1" }) as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([{ id: "c1" }]);
  });
});

describe("/api/visits/[id]/comments POST", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/visits/v1/comments", {
        method: "POST",
        json: { content: "hi" },
      }) as never,
      makeContext({ id: "v1" }) as never
    );
    expect(res.status).toBe(401);
  });

  it("rejects empty comment with no image", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/visits/v1/comments", {
        method: "POST",
        json: { content: "" },
      }) as never,
      makeContext({ id: "v1" }) as never
    );
    expect(res.status).toBe(400);
  });

  it("inserts comment + creates notification for visit author", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);

    // Sequence: insert comment (visit_comments), then fetch visit (visits),
    // then maybe parent comment lookup
    const supabase = makeSupabase({
      visit_comments: [
        // POST insert
        {
          data: {
            id: "c1",
            visit_id: "v1",
            user_id: fakeDelegue.id,
            content: "hi",
            user: { id: fakeDelegue.id },
          },
          error: null,
        },
      ],
      visits: { data: { user_id: "author_x" }, error: null },
    });
    mockCreateClient.mockResolvedValue(supabase);

    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/visits/v1/comments", {
        method: "POST",
        json: { content: "hi" },
      }) as never,
      makeContext({ id: "v1" }) as never
    );
    expect(res.status).toBe(201);
    expect(mockCreateNotifications).toHaveBeenCalled();
  });

  it("does NOT notify if commenter is the visit author", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const supabase = makeSupabase({
      visit_comments: { data: { id: "c1", user: {} }, error: null },
      visits: { data: { user_id: fakeDelegue.id }, error: null },
    });
    mockCreateClient.mockResolvedValue(supabase);

    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/visits/v1/comments", {
        method: "POST",
        json: { content: "self comment" },
      }) as never,
      makeContext({ id: "v1" }) as never
    );
    expect(res.status).toBe(201);
    expect(mockCreateNotifications).not.toHaveBeenCalled();
  });
});
