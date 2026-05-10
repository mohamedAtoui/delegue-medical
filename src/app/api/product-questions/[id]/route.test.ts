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

describe("/api/product-questions/[id] PATCH", () => {
  it("rejects delegue", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/product-questions/q1", {
        method: "PATCH",
        json: { label: "x" },
      }) as never,
      makeContext({ id: "q1" }) as never
    );
    expect(res.status).toBe(403);
  });

  it("rejects empty label", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/product-questions/q1", {
        method: "PATCH",
        json: { label: "   " },
      }) as never,
      makeContext({ id: "q1" }) as never
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid input_type", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      makeRequest("http://x/api/product-questions/q1", {
        method: "PATCH",
        json: { input_type: "audio" },
      }) as never,
      makeContext({ id: "q1" }) as never
    );
    expect(res.status).toBe(400);
  });
});

describe("/api/product-questions/[id] DELETE", () => {
  it("rejects delegue", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/product-questions/q1") as never,
      makeContext({ id: "q1" }) as never
    );
    expect(res.status).toBe(403);
  });

  it("supervisor soft-deletes", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({ product_questions: { data: { id: "q1" }, error: null } })
    );
    const { DELETE } = await import("./route");
    const res = await DELETE(
      makeRequest("http://x/api/product-questions/q1") as never,
      makeContext({ id: "q1" }) as never
    );
    expect(res.status).toBe(200);
  });
});
