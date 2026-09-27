// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VisitesClient } from "./visites-client";
import { saveVisitDraft, setVisitFormOpen, type VisitDraft } from "@/lib/visits/visit-draft";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/offline/use-visit-sync", () => ({
  useVisitSync: () => ({ pending: 0 }),
}));
vi.mock("@/components/visits/visit-form", () => ({
  VisitForm: () => <div data-testid="visit-form">Formulaire de visite</div>,
}));
vi.mock("@/components/visits/visit-history", () => ({
  VisitHistory: () => <div />,
}));

const draft: VisitDraft = {
  visitType: "medecin",
  productId: "product-1",
  doctor: null,
  objective: "Présenter le produit",
  compteRendu: "",
  engagement: null,
  grossistes: [],
  timings: [],
  answers: {},
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
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({}) })));
});

afterEach(() => {
  cleanup();
  if (originalStorage) Object.defineProperty(window, "localStorage", originalStorage);
  vi.unstubAllGlobals();
});

describe("VisitesClient draft navigation", () => {
  it("reopens the form after returning, and offers Resume after intentionally closing it", async () => {
    saveVisitDraft("user-1", draft);
    setVisitFormOpen("user-1", true);

    render(<VisitesClient role="delegue" userId="user-1" initialVisits={[]} initialTotal={0} />);
    await waitFor(() => expect(screen.getByTestId("visit-form")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Retour aux visites" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Reprendre la visite" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Reprendre la visite" }));
    expect(screen.getByTestId("visit-form")).toBeTruthy();
  });
});
