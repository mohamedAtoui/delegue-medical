import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeSupabase } from "../../../../../tests/helpers/supabase-mock";

const mockAuth = vi.fn();
const mockCreateClient = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mockCreateClient() }));

beforeEach(() => {
  mockAuth.mockReset();
  mockCreateClient.mockReset();
});

describe("/api/products/questions GET", () => {
  it("rejects unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await import("./route");
    const res = await GET(
      makeRequest("http://x/api/products/questions?target_role=pharmacien") as never
    );
    expect(res.status).toBe(401);
  });

  it("requires target_role", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    const { GET } = await import("./route");
    const res = await GET(
      makeRequest("http://x/api/products/questions") as never
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid target_role", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    const { GET } = await import("./route");
    const res = await GET(
      makeRequest("http://x/api/products/questions?target_role=admin") as never
    );
    expect(res.status).toBe(400);
  });

  it("returns questions, filters out inactive products", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_d" });
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        product_questions: {
          data: [
            { id: "q1", product: { id: "p1", name: "A", active: true } },
            { id: "q2", product: { id: "p2", name: "B", active: false } },
            { id: "q3", product: { id: "p3", name: "C", active: true } },
          ],
          error: null,
        },
      })
    );
    const { GET } = await import("./route");
    const res = await GET(
      makeRequest("http://x/api/products/questions?target_role=pharmacien") as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body.map((q: { id: string }) => q.id)).toEqual(["q1", "q3"]);
  });
});
