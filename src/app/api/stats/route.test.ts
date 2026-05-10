import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest } from "../../../../tests/helpers/supabase-mock";
import { fakeDelegue, fakeSuperviseur } from "../../../../tests/helpers/auth-mock";

const mockAuth = vi.fn();
const mockGetOrCreateUser = vi.fn();
const mockFetchStats = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/clerk/sync-user", () => ({ getOrCreateUser: () => mockGetOrCreateUser() }));
vi.mock("@/lib/queries/stats", () => ({
  fetchDashboardStats: (...args: unknown[]) => mockFetchStats(...args),
}));

beforeEach(() => {
  mockAuth.mockReset();
  mockGetOrCreateUser.mockReset();
  mockFetchStats.mockReset();
});

describe("/api/stats GET", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/stats") as never);
    expect(res.status).toBe(401);
  });

  it("rejects delegue", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/stats") as never);
    expect(res.status).toBe(403);
  });

  it("supervisor gets stats", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_s" });
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockFetchStats.mockResolvedValue({ total: 10, byRep: [], byWilaya: [] });
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/stats") as never);
    expect(res.status).toBe(200);
  });
});
