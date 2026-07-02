export interface GrossisteLink {
  grossiste_id: string;
  category: "pharma" | "para_pharm";
}

/** Normalise an incoming grossistes[] payload to valid link rows. */
export function cleanGrossisteLinks(input: unknown): GrossisteLink[] {
  if (!Array.isArray(input)) return [];
  return input.filter(
    (g): g is GrossisteLink =>
      !!g &&
      typeof g.grossiste_id === "string" &&
      (g.category === "pharma" || g.category === "para_pharm")
  );
}
