import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeSupabase } from "../../../../tests/helpers/supabase-mock";
import { fakeDelegue } from "../../../../tests/helpers/auth-mock";

const mockAuth = vi.fn();
const mockGetOrCreateUser = vi.fn();
const mockCreateClient = vi.fn();
const mockFetchDoctors = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));
vi.mock("@/lib/clerk/sync-user", () => ({ getOrCreateUser: () => mockGetOrCreateUser() }));
vi.mock("@/lib/queries/doctors", () => ({
  fetchDoctors: (...args: unknown[]) => mockFetchDoctors(...args),
}));

beforeEach(() => {
  mockAuth.mockReset();
  mockGetOrCreateUser.mockReset();
  mockCreateClient.mockReset();
  mockFetchDoctors.mockReset();
});

describe("/api/doctors GET", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/doctors") as never);
    expect(res.status).toBe(401);
  });

  it("returns doctors list", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockFetchDoctors.mockResolvedValue({ data: [{ id: "d1" }], count: 1 });
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/doctors") as never);
    expect(res.status).toBe(200);
  });
});

describe("/api/doctors POST", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/doctors", { method: "POST", json: {} }) as never
    );
    expect(res.status).toBe(401);
  });

  it("requires first_name + last_name + wilaya", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/doctors", {
        method: "POST",
        json: { first_name: "X" },
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("requires specialty for médecin", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/doctors", {
        method: "POST",
        json: {
          first_name: "X",
          last_name: "Y",
          wilaya: "Alger",
          doctor_type: "medecin",
          address: "rue 1",
          phone_fixe: "021",
        },
      }) as never
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/spécialité/i);
  });

  it("creates doctor when fields valid", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        doctors: { data: { id: "d1", first_name: "X" }, error: null },
      })
    );
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/doctors", {
        method: "POST",
        json: {
          first_name: "Aicha",
          last_name: "Atoui",
          wilaya: "Alger",
          doctor_type: "pharmacien",
          address: "rue 1",
          phone_fixe: "021",
        },
      }) as never
    );
    expect(res.status).toBe(201);
  });
});
