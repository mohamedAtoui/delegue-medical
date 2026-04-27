import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeSupabase } from "../../../../tests/helpers/supabase-mock";
import { fakeDelegue, fakeSuperviseur } from "../../../../tests/helpers/auth-mock";

const mockGetOrCreateUser = vi.fn();
const mockCreateClient = vi.fn();
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));
vi.mock("@/lib/clerk/sync-user", () => ({ getOrCreateUser: () => mockGetOrCreateUser() }));

beforeEach(() => {
  mockGetOrCreateUser.mockReset();
  mockCreateClient.mockReset();
});

describe("/api/products GET", () => {
  it("returns active products by default", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({ products: { data: [{ id: "p1" }], error: null } })
    );
    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://x/api/products") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ id: "p1" }]);
  });

  it("supports include_inactive=true", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({ products: { data: [{ id: "p1" }, { id: "p2" }], error: null } })
    );
    const { GET } = await import("./route");
    const res = await GET(
      makeRequest("http://x/api/products?include_inactive=true") as never
    );
    expect(res.status).toBe(200);
  });
});

describe("/api/products POST", () => {
  it("rejects unauthenticated", async () => {
    mockGetOrCreateUser.mockResolvedValue(null);
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/products", { method: "POST", json: { name: "x" } }) as never
    );
    expect(res.status).toBe(401);
  });

  it("rejects delegue", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/products", { method: "POST", json: { name: "x" } }) as never
    );
    expect(res.status).toBe(403);
  });

  it("requires name", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/products", { method: "POST", json: {} }) as never
    );
    expect(res.status).toBe(400);
  });

  it("supervisor can create product", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({ products: { data: { id: "p1", name: "X" }, error: null } })
    );
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/products", {
        method: "POST",
        json: { name: "Pillbox P7", quantity: 10, price: 1500 },
      }) as never
    );
    expect(res.status).toBe(201);
  });
});
