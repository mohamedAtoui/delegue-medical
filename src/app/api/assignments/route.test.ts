import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeSupabase } from "../../../../tests/helpers/supabase-mock";
import { fakeDelegue, fakeSuperviseur } from "../../../../tests/helpers/auth-mock";

const mockAuth = vi.fn();
const mockGetOrCreateUser = vi.fn();
const mockCreateClient = vi.fn();
const mockFetchAssignments = vi.fn();
const mockCreateNotifications = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));
vi.mock("@/lib/clerk/sync-user", () => ({ getOrCreateUser: () => mockGetOrCreateUser() }));
vi.mock("@/lib/queries/assignments", () => ({
  fetchAssignments: (...args: unknown[]) => mockFetchAssignments(...args),
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotifications: (...args: unknown[]) => mockCreateNotifications(...args),
}));

beforeEach(() => {
  mockAuth.mockReset();
  mockGetOrCreateUser.mockReset();
  mockCreateClient.mockReset();
  mockFetchAssignments.mockReset();
  mockCreateNotifications.mockReset();
});

describe("/api/assignments GET", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/assignments") as never);
    expect(res.status).toBe(401);
  });

  it("returns list", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    mockFetchAssignments.mockResolvedValue({ data: [{ id: "a1" }], count: 1 });
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/assignments") as never);
    expect(res.status).toBe(200);
  });
});

describe("/api/assignments POST", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/assignments", {
        method: "POST",
        json: { doctor_id: "d1", deadline: "2030-01-01" },
      }) as never
    );
    expect(res.status).toBe(401);
  });

  it("requires doctor_id and deadline", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/assignments", {
        method: "POST",
        json: {},
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("delegue cannot assign to another user", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/assignments", {
        method: "POST",
        json: {
          assignee_id: "other-user",
          doctor_id: "d1",
          deadline: "2030-01-01",
        },
      }) as never
    );
    expect(res.status).toBe(403);
  });

  it("delegue self-assignment via 'self' is allowed and skips notification", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        visit_assignments: {
          data: {
            id: "a1",
            doctor: { last_name: "Y", first_name: "X", doctor_type: "medecin" },
          },
          error: null,
        },
      })
    );
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/assignments", {
        method: "POST",
        json: {
          assignee_id: "self",
          doctor_id: "d1",
          deadline: "2030-01-01",
        },
      }) as never
    );
    expect(res.status).toBe(201);
    expect(mockCreateNotifications).not.toHaveBeenCalled();
  });

  it("supervisor assigning to delegue creates a notification", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_s" });
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        visit_assignments: {
          data: {
            id: "a1",
            doctor: { last_name: "Y", first_name: "X", doctor_type: "medecin" },
          },
          error: null,
        },
      })
    );
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/assignments", {
        method: "POST",
        json: {
          assignee_id: "delegue-1",
          doctor_id: "d1",
          deadline: "2030-01-01",
        },
      }) as never
    );
    expect(res.status).toBe(201);
    expect(mockCreateNotifications).toHaveBeenCalled();
  });
});
