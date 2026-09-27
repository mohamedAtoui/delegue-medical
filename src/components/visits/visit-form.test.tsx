// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { VisitForm } from "./visit-form";
import { readVisitDraft, saveVisitDraft, type VisitDraft } from "@/lib/visits/visit-draft";
import type { Doctor } from "@/types";

vi.mock("@/components/visits/visit-timer", () => ({
  VisitTimer: ({ value }: { value: unknown[] }) => <div data-testid="timings">{value.length}</div>,
}));
vi.mock("@/components/visits/doctor-visit-timeline", () => ({
  DoctorVisitTimeline: () => <div />,
}));
vi.mock("@/components/doctors/doctor-search", () => ({
  DoctorSearch: ({ selectedDoctor }: { selectedDoctor: Doctor | null }) => (
    <div data-testid="selected-doctor">{selectedDoctor?.last_name ?? ""}</div>
  ),
}));
vi.mock("@/components/doctors/doctor-form", () => ({ DoctorForm: () => <div /> }));
vi.mock("@/components/shared/product-select", () => ({
  ProductSelect: ({ value }: { value: string }) => <div data-testid="product">{value}</div>,
}));
vi.mock("@/components/shared/engagement-stars", () => ({
  EngagementStars: () => <div />,
}));
vi.mock("@/components/doctors/grossiste-combobox", () => ({
  GrossisteMultiSelect: () => <div />,
  expandGrossisteSelection: () => [],
}));

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
  objective: "Présenter le produit",
  compteRendu: "Premier compte rendu",
  engagement: 2,
  grossistes: [],
  timings: [{ stage: "visite", started_at: null, ended_at: null, duration_seconds: 300, mode: "manual" }],
  answers: { "question-1": { value_text: "Réponse conservée" } },
  planNext: false,
  nextDeadline: "",
  nextNote: "",
};

let originalStorage: PropertyDescriptor | undefined;

beforeEach(() => {
  const values = new Map<string, string>();
  originalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  });
  vi.stubGlobal("fetch", vi.fn(async (input: string) => ({
    ok: true,
    json: async () => input.includes("/questions") ? [{
      id: "question-1",
      product_id: "product-1",
      target_role: "medecin",
      label: "Retour du médecin",
      input_type: "textarea",
      required: false,
      display_order: 1,
      visible_when: null,
    }] : {},
  })));
});

afterEach(() => {
  cleanup();
  if (originalStorage) Object.defineProperty(window, "localStorage", originalStorage);
  vi.unstubAllGlobals();
});

describe("VisitForm draft", () => {
  it("restores all visit fields and answers after unmounting and reopening", async () => {
    saveVisitDraft("user-1", draft);
    const first = render(<VisitForm userId="user-1" onSuccess={vi.fn()} />);

    await waitFor(() => expect(screen.getByDisplayValue("Réponse conservée")).toBeTruthy());
    expect(screen.getByDisplayValue("Présenter le produit")).toBeTruthy();
    expect(screen.getByTestId("selected-doctor").textContent).toBe("Atoui");
    expect(screen.getByTestId("product").textContent).toBe("product-1");
    expect(screen.getByTestId("timings").textContent).toBe("1");

    fireEvent.change(screen.getByLabelText("Compte rendu de la visite *"), {
      target: { value: "Compte rendu mis à jour" },
    });
    await waitFor(() => expect(readVisitDraft("user-1")?.compteRendu).toBe("Compte rendu mis à jour"));

    first.unmount();
    render(<VisitForm userId="user-1" onSuccess={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Compte rendu mis à jour")).toBeTruthy());
    expect(screen.getByDisplayValue("Réponse conservée")).toBeTruthy();
  });

  it("clears the draft only after a successful visit", async () => {
    saveVisitDraft("user-1", draft);
    const onSuccess = vi.fn();
    render(<VisitForm userId="user-1" onSuccess={onSuccess} />);

    await waitFor(() => expect(screen.getByDisplayValue("Premier compte rendu")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la visite" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(readVisitDraft("user-1")).toBeNull();
  });
});
