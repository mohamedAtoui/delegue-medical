// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { VisitForm } from "./visit-form";
import { readVisitDraft, saveVisitDraft, type VisitDraft } from "@/lib/visits/visit-draft";
import type { Doctor, DoctorType } from "@/types";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock("@/components/visits/visit-timer", () => ({
  VisitTimer: ({ value }: { value: unknown[] }) => <div data-testid="timings">{value.length}</div>,
}));
vi.mock("@/components/visits/doctor-visit-timeline", () => ({
  DoctorVisitTimeline: () => <div />,
}));
vi.mock("@/components/doctors/doctor-search", () => ({
  DoctorSearch: ({ selectedDoctor, type, onSelect }: { selectedDoctor: Doctor | null; type: DoctorType; onSelect: (doctor: Doctor) => void }) => (
    <div><span data-testid="selected-doctor">{selectedDoctor?.last_name ?? ""}</span>
      <button type="button" onClick={() => onSelect({ id: "11111111-1111-4111-8111-111111111111", first_name: "Aicha", last_name: "Atoui", doctor_type: type, wilaya: "Alger" } as Doctor)}>Choisir contact test</button>
    </div>
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
  focusDoctorCount: "",
  focusLieu: "",
  focusBudget: "",
  focusAnimateur: "",
  focusAudienceType: "",
  focusContacts: [],
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
    const first = render(<VisitForm userId="user-1" onSuccess={vi.fn()} onSaveDraft={vi.fn()} />);

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
    render(<VisitForm userId="user-1" onSuccess={vi.fn()} onSaveDraft={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue("Compte rendu mis à jour")).toBeTruthy());
    expect(screen.getByDisplayValue("Réponse conservée")).toBeTruthy();
  });

  it("clears the draft only after a successful visit", async () => {
    saveVisitDraft("user-1", draft);
    const onSuccess = vi.fn();
    render(<VisitForm userId="user-1" onSuccess={onSuccess} onSaveDraft={vi.fn()} />);

    await waitFor(() => expect(screen.getByDisplayValue("Premier compte rendu")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la visite" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(readVisitDraft("user-1")).toBeNull();
  });

  it("saves a draft without submitting the visit, then lets the delegate resume it", async () => {
    const onSaveDraft = vi.fn();
    const onSuccess = vi.fn();
    const fetchMock = vi.mocked(fetch);
    render(<VisitForm userId="user-1" onSuccess={onSuccess} onSaveDraft={onSaveDraft} />);

    await waitFor(() => expect(screen.getByLabelText("Objectif de la visite *")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Objectif de la visite *"), {
      target: { value: "Présenter Synapgen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer comme brouillon" }));

    expect(onSaveDraft).toHaveBeenCalledOnce();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(readVisitDraft("user-1")?.objective).toBe("Présenter Synapgen");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/visits", expect.anything());
  });

  it("submits a Focus without choosing a doctor and preserves its fields in a draft", async () => {
    const onSuccess = vi.fn();
    render(<VisitForm userId="user-1" onSuccess={onSuccess} onSaveDraft={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Focus" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Focus" }));
    fireEvent.click(screen.getByRole("button", { name: "Médecins" }));
    fireEvent.change(screen.getByLabelText("Nombre de médecins présents *"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Lieu *"), { target: { value: "Alger" } });
    fireEvent.change(screen.getByLabelText("Budget (DA) *"), { target: { value: "15000" } });
    fireEvent.change(screen.getByLabelText("Animateur *"), { target: { value: "Amina" } });
    fireEvent.change(screen.getByLabelText("Compte rendu de la visite *"), { target: { value: "Présentation collective" } });
    expect(readVisitDraft("user-1")?.focusLieu).toBe("Alger");
    expect(readVisitDraft("user-1")).toEqual(expect.objectContaining({
      focusDoctorCount: "12", focusBudget: "15000", focusAnimateur: "Amina", focusAudienceType: "medecin", compteRendu: "Présentation collective",
    }));
    expect((screen.getByRole("button", { name: "Enregistrer la visite" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la visite" }));
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/visits", expect.anything()));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/visits", expect.objectContaining({
      body: expect.stringContaining('"focus_doctor_count":12'),
    }));
  });

  it("keeps Focus participants in the draft and clears them when the audience changes", async () => {
    render(<VisitForm userId="user-1" onSuccess={vi.fn()} onSaveDraft={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Focus" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Focus" }));
    fireEvent.click(screen.getByRole("button", { name: "Pharmacies" }));
    fireEvent.click(screen.getByRole("button", { name: "Choisir contact test" }));
    await waitFor(() => expect(readVisitDraft("user-1")?.focusContacts).toHaveLength(1));
    expect(screen.getByText("Atoui Aicha")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Médecins" }));
    await waitFor(() => expect(readVisitDraft("user-1")?.focusContacts).toHaveLength(0));
    expect(readVisitDraft("user-1")?.focusAudienceType).toBe("medecin");
  });
});
