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

describe("/api/assignments/[id] PATCH", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/assignments/a1", { method: "PATCH", json: {} }) as never,
      makeContext({ id: "a1" }) as never
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 if assignment missing", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    mockCreateClient.mockResolvedValue(
      makeSupabase({ visit_assignments: { data: null, error: null } })
    );
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/assignments/a1", { method: "PATCH", json: {} }) as never,
      makeContext({ id: "a1" }) as never
    );
    expect(res.status).toBe(404);
  });

  it("rejects delegue editing someone else's assignment", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        visit_assignments: { data: { assignee_id: "other-user" }, error: null },
      })
    );
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/assignments/a1", {
        method: "PATCH",
        json: { deadline: "2030-01-01" },
      }) as never,
      makeContext({ id: "a1" }) as never
    );
    expect(res.status).toBe(403);
  });

  it("supervisor can patch any", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_s" });
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        visit_assignments: [
          { data: { assignee_id: "any-delegue" }, error: null }, // existing fetch
          { data: { id: "a1" }, error: null }, // update returning
        ],
      })
    );
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/assignments/a1", {
        method: "PATCH",
        json: { note: "updated" },
      }) as never,
      makeContext({ id: "a1" }) as never
    );
    expect(res.status).toBe(200);
  });
});

describe("/api/assignments/[id] DELETE", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/assignments/a1") as never,
      makeContext({ id: "a1" }) as never
    );
    expect(res.status).toBe(401);
  });

  it("delegue cannot delete someone else's", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        visit_assignments: { data: { assignee_id: "other" }, error: null },
      })
    );
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/assignments/a1") as never,
      makeContext({ id: "a1" }) as never
    );
    expect(res.status).toBe(403);
  });

  it("supervisor can delete", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_s" });
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        visit_assignments: { data: { assignee_id: "x" }, error: null },
      })
    );
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/assignments/a1") as never,
      makeContext({ id: "a1" }) as never
    );
    expect(res.status).toBe(200);
  });
});
