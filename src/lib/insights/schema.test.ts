import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRunSql = vi.fn();
vi.mock("./db", () => ({
  runReadOnlySql: (...args: unknown[]) => mockRunSql(...args),
}));

beforeEach(() => {
  mockRunSql.mockReset();
});

describe("getLiveSchema", () => {
  it("returns null when introspection throws (fallback path)", async () => {
    mockRunSql.mockRejectedValue(new Error("connection refused"));
    const { getLiveSchema, _clearSchemaCache } = await import("./schema");
    _clearSchemaCache();
    expect(await getLiveSchema()).toBeNull();
  });

  it("returns null when there are no rows", async () => {
    mockRunSql.mockResolvedValue({ rows: [], rowCount: 0, truncated: false });
    const { getLiveSchema, _clearSchemaCache } = await import("./schema");
    _clearSchemaCache();
    expect(await getLiveSchema()).toBeNull();
  });

  it("formats columns grouped by table", async () => {
    mockRunSql.mockResolvedValue({
      rows: [
        { table_name: "visits", column_name: "id", data_type: "uuid" },
        { table_name: "visits", column_name: "engagement", data_type: "integer" },
        { table_name: "doctors", column_name: "id", data_type: "uuid" },
      ],
      rowCount: 3,
      truncated: false,
    });
    const { getLiveSchema, _clearSchemaCache } = await import("./schema");
    _clearSchemaCache();
    const text = await getLiveSchema();
    expect(text).toContain("visits(id uuid, engagement integer)");
    expect(text).toContain("doctors(id uuid)");
  });
});
