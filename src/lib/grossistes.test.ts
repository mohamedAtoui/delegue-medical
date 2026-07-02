import { describe, it, expect } from "vitest";
import { cleanGrossisteLinks } from "./grossistes";

describe("cleanGrossisteLinks", () => {
  it("returns [] for non-arrays", () => {
    expect(cleanGrossisteLinks(undefined)).toEqual([]);
    expect(cleanGrossisteLinks(null)).toEqual([]);
    expect(cleanGrossisteLinks("nope")).toEqual([]);
  });

  it("keeps only valid link rows", () => {
    const out = cleanGrossisteLinks([
      { grossiste_id: "g1", category: "pharma" },
      { grossiste_id: "g2", category: "para_pharm" },
      { grossiste_id: "g3", category: "invalid" },
      { category: "pharma" },
      { grossiste_id: 123, category: "pharma" },
      null,
    ]);
    expect(out).toEqual([
      { grossiste_id: "g1", category: "pharma" },
      { grossiste_id: "g2", category: "para_pharm" },
    ]);
  });
});
