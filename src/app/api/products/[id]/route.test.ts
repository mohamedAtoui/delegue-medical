import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeContext, makeRequest, makeSupabase } from "../../../../../tests/helpers/supabase-mock";
import { fakeDelegue, fakeSuperviseur } from "../../../../../tests/helpers/auth-mock";

const mockGetOrCreateUser = vi.fn();
const mockCreateClient = vi.fn();
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));
vi.mock("@/lib/clerk/sync-user", () => ({ getOrCreateUser: () => mockGetOrCreateUser() }));

beforeEach(() => {
  mockGetOrCreateUser.mockReset();
  mockCreateClient.mockReset();
});

describe("/api/products/[id] PATCH", () => {
  it("rejects delegue", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/products/p1", {
        method: "PATCH",
        json: { name: "X" },
      }) as never,
      makeContext({ id: "p1" }) as never
    );
    expect(res.status).toBe(403);
  });

  it("rejects empty patch", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/products/p1", { method: "PATCH", json: {} }) as never,
      makeContext({ id: "p1" }) as never
    );
    expect(res.status).toBe(400);
  });

  it("supervisor can patch", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({ products: { data: { id: "p1", name: "Updated" }, error: null } })
    );
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/products/p1", {
        method: "PATCH",
        json: { quantity: 25 },
      }) as never,
      makeContext({ id: "p1" }) as never
    );
    expect(res.status).toBe(200);
  });
});

describe("/api/products/[id] DELETE", () => {
  it("rejects delegue", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/products/p1") as never,
      makeContext({ id: "p1" }) as never
    );
    expect(res.status).toBe(403);
  });

  it("supervisor can delete", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({ products: { data: null, error: null } })
    );
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/products/p1") as never,
      makeContext({ id: "p1" }) as never
    );
    expect(res.status).toBe(200);
  });
});
