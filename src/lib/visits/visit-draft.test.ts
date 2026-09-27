import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearVisitDraft,
  isVisitFormOpen,
  readVisitDraft,
  saveVisitDraft,
  setVisitFormOpen,
  type VisitDraft,
} from "./visit-draft";
import type { Doctor } from "@/types";

const doctor = {
  id: "doctor-1",
  first_name: "Aicha",
  last_name: "Atoui",
  doctor_type: "medecin",
  wilaya: "Alger",
} as Doctor;

const draft: VisitDraft = {
  visitType: "medecin",
  productId: "product-1",
  doctor,
  objective: "Présenter le traitement",
  compteRendu: "Retour favorable",
  engagement: 2,
  grossistes: [],
  timings: [{ stage: "visite", started_at: null, ended_at: null, duration_seconds: 480, mode: "manual" }],
  answers: { "question-1": { value_boolean: false }, "question-2": { value_text: "À revoir" } },
  planNext: true,
  nextDeadline: "2026-10-10T23:59:59.000Z",
  nextNote: "Revoir les retours",
};

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("visit draft persistence", () => {
  it("restores a complete visit after browser state is lost", () => {
    expect(saveVisitDraft("user-1", draft)).toBe(true);
    expect(readVisitDraft("user-1")).toEqual(expect.objectContaining(draft));
  });

  it("keeps drafts and the open form separate for each user", () => {
    saveVisitDraft("user-1", draft);
    setVisitFormOpen("user-1", true);

    expect(readVisitDraft("user-2")).toBeNull();
    expect(isVisitFormOpen("user-2")).toBe(false);
    expect(isVisitFormOpen("user-1")).toBe(true);

    setVisitFormOpen("user-1", false);
    expect(isVisitFormOpen("user-1")).toBe(false);
    expect(readVisitDraft("user-1")).not.toBeNull();
  });

  it("keeps pharmacy grossistes and next-visit planning together", () => {
    const pharmacy = {
      ...draft,
      visitType: "pharmacien" as const,
      doctor: { ...doctor, id: "pharmacy-1", doctor_type: "pharmacien" as const },
      productId: "",
      grossistes: [{ id: "grossiste-1", last_name: "Fournisseur", wilaya: "Alger", category: "both" as const }],
      timings: [],
    };

    saveVisitDraft("user-1", pharmacy);
    expect(readVisitDraft("user-1")).toEqual(expect.objectContaining({
      visitType: "pharmacien",
      grossistes: pharmacy.grossistes,
      planNext: true,
      nextDeadline: pharmacy.nextDeadline,
    }));
  });

  it("does not keep an empty visit, and clears only after saving", () => {
    saveVisitDraft("user-1", draft);
    clearVisitDraft("user-1");
    expect(readVisitDraft("user-1")).toBeNull();

    saveVisitDraft("user-1", {
      ...draft,
      productId: "",
      doctor: null,
      objective: "",
      compteRendu: "",
      engagement: null,
      timings: [],
      answers: {},
      planNext: false,
      nextDeadline: "",
      nextNote: "",
    });
    expect(readVisitDraft("user-1")).toBeNull();
  });

  it("ignores corrupt or mismatched saved data", () => {
    window.localStorage.setItem("handson.visitDraft.v1.user-1", "{broken");
    expect(readVisitDraft("user-1")).toBeNull();

    saveVisitDraft("user-1", { ...draft, visitType: "pharmacien" });
    expect(readVisitDraft("user-1")).toBeNull();
  });
});
