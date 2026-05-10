import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeSupabase } from "../../../../tests/helpers/supabase-mock";
import { fakeDelegue } from "../../../../tests/helpers/auth-mock";

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

describe("/api/onboarding POST", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/onboarding", { method: "POST", json: {} }) as never
    );
    expect(res.status).toBe(401);
  });

  it("requires phone and wilayas", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/onboarding", {
        method: "POST",
        json: { phone: "" },
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("rejects empty wilayas array", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/onboarding", {
        method: "POST",
        json: { phone: "0555000000", wilayas: [] },
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("happy path", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        users: { data: null, error: null },
        territory_assignments: { data: null, error: null },
      })
    );
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/onboarding", {
        method: "POST",
        json: { phone: "0555000000", wilayas: ["Alger", "Oran"] },
      }) as never
    );
    expect(res.status).toBe(200);
  });
});
