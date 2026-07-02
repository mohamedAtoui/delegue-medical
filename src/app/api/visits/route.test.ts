import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabase, makeRequest } from "../../../../tests/helpers/supabase-mock";
import { fakeDelegue, fakeSuperviseur } from "../../../../tests/helpers/auth-mock";

const mockAuth = vi.fn();
const mockGetOrCreateUser = vi.fn();
const mockCreateClient = vi.fn();
const mockFetchVisits = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));
vi.mock("@/lib/clerk/sync-user", () => ({
  getOrCreateUser: () => mockGetOrCreateUser(),
}));
vi.mock("@/lib/queries/visits", () => ({
  fetchVisits: (...args: unknown[]) => mockFetchVisits(...args),
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotifications: vi.fn(),
}));

beforeEach(() => {
  mockAuth.mockReset();
  mockGetOrCreateUser.mockReset();
  mockCreateClient.mockReset();
  mockFetchVisits.mockReset();
});

describe("/api/visits POST", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/visits", {
        method: "POST",
        json: { doctor_id: "d1", visit_type: "medecin" },
      }) as never
    );
    expect(res.status).toBe(401);
  });

  it("requires doctor_id", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_x" });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/visits", {
        method: "POST",
        json: { visit_type: "medecin" },
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("requires product_id for médecin visits", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_x" });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/visits", {
        method: "POST",
        json: {
          doctor_id: "d1",
          visit_type: "medecin",
          objective: "x",
          compte_rendu: "y",
        },
      }) as never
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/produit/i);
  });

  it("allows pharmacien visits without product_id", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const insertedVisit = {
      id: "v1",
      doctor_id: "d1",
      product_id: null,
      visit_type: "pharmacien",
      doctor: { id: "d1", doctor_type: "pharmacien" },
      user: fakeDelegue,
    };
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        visits: { data: insertedVisit, error: null },
        visit_assignments: { data: [], error: null },
      })
    );
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/visits", {
        method: "POST",
        json: {
          doctor_id: "d1",
          visit_type: "pharmacien",
          compte_rendu: "ok",
        },
      }) as never
    );
    expect(res.status).toBe(201);
  });

  it("requires compte_rendu for pharmacien", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/visits", {
        method: "POST",
        json: { doctor_id: "d1", visit_type: "pharmacien" },
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("requires objective + compte_rendu for médecin", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/visits", {
        method: "POST",
        json: {
          doctor_id: "d1",
          product_id: "p1",
          visit_type: "medecin",
        },
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("accepts a grossiste visit without product", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        visits: {
          data: {
            id: "v9",
            doctor_id: "g1",
            visit_type: "grossiste",
            doctor: { id: "g1", doctor_type: "grossiste" },
            user: fakeDelegue,
          },
          error: null,
        },
        visit_assignments: { data: [], error: null },
      })
    );
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/visits", {
        method: "POST",
        json: {
          doctor_id: "g1",
          visit_type: "grossiste",
          compte_rendu: "livraison ok",
        },
      }) as never
    );
    expect(res.status).toBe(201);
  });

  it("rejects an out-of-range engagement", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/visits", {
        method: "POST",
        json: {
          doctor_id: "d1",
          visit_type: "pharmacien",
          compte_rendu: "ok",
          engagement: 6,
        },
      }) as never
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/engagement/i);
  });

  it("persists visit_grossistes for a pharmacien visit", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const supa = makeSupabase({
      visits: {
        data: {
          id: "v10",
          doctor_id: "ph1",
          visit_type: "pharmacien",
          doctor: { id: "ph1", doctor_type: "pharmacien" },
          user: fakeDelegue,
        },
        error: null,
      },
      visit_grossistes: { data: null, error: null },
      doctor_grossistes: { data: null, error: null },
      visit_assignments: { data: [], error: null },
    });
    mockCreateClient.mockResolvedValue(supa);
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/visits", {
        method: "POST",
        json: {
          doctor_id: "ph1",
          visit_type: "pharmacien",
          compte_rendu: "ok",
          engagement: 3,
          grossistes: [{ grossiste_id: "g1", category: "pharma" }],
        },
      }) as never
    );
    expect(res.status).toBe(201);
    expect(supa._fromMock).toHaveBeenCalledWith("visit_grossistes");
    expect(supa._fromMock).toHaveBeenCalledWith("doctor_grossistes");
  });
});

describe("/api/visits GET", () => {
  it("returns 401 unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/visits") as never);
    expect(res.status).toBe(401);
  });

  it("returns visit list for delegue (own visits)", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    mockFetchVisits.mockResolvedValue({
      data: [{ id: "v1" }, { id: "v2" }],
      count: 2,
    });
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/visits") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });

  it("supports all=true for supervisor", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_s" });
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockFetchVisits.mockResolvedValue({ data: [], count: 0 });
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/visits?all=true") as never);
    expect(res.status).toBe(200);
    expect(mockFetchVisits).toHaveBeenCalledWith(
      expect.objectContaining({ all: true })
    );
  });
});
