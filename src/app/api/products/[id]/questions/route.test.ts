import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeContext, makeRequest, makeSupabase } from "../../../../../../tests/helpers/supabase-mock";
import { fakeDelegue, fakeSuperviseur } from "../../../../../../tests/helpers/auth-mock";

const mockGetOrCreateUser = vi.fn();
const mockCreateClient = vi.fn();
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));
vi.mock("@/lib/clerk/sync-user", () => ({ getOrCreateUser: () => mockGetOrCreateUser() }));

beforeEach(() => {
  mockGetOrCreateUser.mockReset();
  mockCreateClient.mockReset();
});

describe("/api/products/[id]/questions GET", () => {
  it("returns the question list", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({ product_questions: { data: [{ id: "q1" }], error: null } })
    );
    const { GET } = await import("./route");
    const res = await GET(
      makeRequest("http://x/api/products/p1/questions") as never,
      makeContext({ id: "p1" }) as never
    );
    expect(res.status).toBe(200);
  });
});

describe("/api/products/[id]/questions POST", () => {
  it("rejects delegue", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeDelegue);
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/products/p1/questions", {
        method: "POST",
        json: { label: "x", target_role: "medecin", input_type: "yes_no" },
      }) as never,
      makeContext({ id: "p1" }) as never
    );
    expect(res.status).toBe(403);
  });

  it("requires label", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/products/p1/questions", {
        method: "POST",
        json: { target_role: "medecin", input_type: "yes_no" },
      }) as never,
      makeContext({ id: "p1" }) as never
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid target_role", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/products/p1/questions", {
        method: "POST",
        json: { label: "x", target_role: "owner", input_type: "yes_no" },
      }) as never,
      makeContext({ id: "p1" }) as never
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid input_type", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/products/p1/questions", {
        method: "POST",
        json: { label: "x", target_role: "medecin", input_type: "richtext" },
      }) as never,
      makeContext({ id: "p1" }) as never
    );
    expect(res.status).toBe(400);
  });

  it("supervisor can create question", async () => {
    mockGetOrCreateUser.mockResolvedValue(fakeSuperviseur);
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        product_questions: [
          { data: { display_order: 4 }, error: null }, // last lookup
          { data: { id: "q1" }, error: null }, // insert
        ],
      })
    );
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest("http://x/api/products/p1/questions", {
        method: "POST",
        json: {
          label: "Nombre de boîtes",
          target_role: "pharmacien",
          input_type: "number",
        },
      }) as never,
      makeContext({ id: "p1" }) as never
    );
    expect(res.status).toBe(201);
  });
});
