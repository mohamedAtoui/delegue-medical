import type { Doctor, VisitTiming, VisitType } from "@/types";
import type { SelectedGrossiste } from "@/components/doctors/grossiste-combobox";

const DRAFT_VERSION = 1;
const DRAFT_PREFIX = "handson.visitDraft.v1";

export interface VisitDraft {
  visitType: VisitType;
  productId: string;
  doctor: Doctor | null;
  objective: string;
  compteRendu: string;
  engagement: number | null;
  grossistes: SelectedGrossiste[];
  timings: VisitTiming[];
  answers: Record<string, {
    value_boolean?: boolean | null;
    value_text?: string;
    value_number?: string;
  }>;
  planNext: boolean;
  nextDeadline: string;
  nextNote: string;
}

type StoredDraft = VisitDraft & { version: number; savedAt: string };
export type VisitDraftRecord = VisitDraft & { savedAt: string };

function draftKey(userId: string): string {
  return `${DRAFT_PREFIX}.${userId}`;
}

function openKey(userId: string): string {
  return `${DRAFT_PREFIX}.open.${userId}`;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function hasVisitDraftContent(draft: VisitDraft): boolean {
  return (
    draft.visitType !== "medecin" ||
    !!draft.productId ||
    !!draft.doctor ||
    !!draft.objective ||
    !!draft.compteRendu ||
    draft.engagement !== null ||
    draft.grossistes.length > 0 ||
    draft.timings.length > 0 ||
    Object.keys(draft.answers).length > 0 ||
    draft.planNext ||
    !!draft.nextDeadline ||
    !!draft.nextNote
  );
}

export function readVisitDraftRecord(userId: string): VisitDraftRecord | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(draftKey(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as StoredDraft;
    if (
      draft.version !== DRAFT_VERSION ||
      !["medecin", "pharmacien", "grossiste"].includes(draft.visitType) ||
      typeof draft.productId !== "string" ||
      typeof draft.objective !== "string" ||
      typeof draft.compteRendu !== "string" ||
      !Array.isArray(draft.grossistes) ||
      !Array.isArray(draft.timings) ||
      !draft.answers ||
      typeof draft.answers !== "object" ||
      Array.isArray(draft.answers) ||
      typeof draft.planNext !== "boolean" ||
      typeof draft.nextDeadline !== "string" ||
      typeof draft.nextNote !== "string" ||
      typeof draft.savedAt !== "string" ||
      (draft.engagement !== null && typeof draft.engagement !== "number") ||
      (draft.doctor !== null &&
        (!draft.doctor ||
          typeof draft.doctor.id !== "string" ||
          draft.doctor.doctor_type !== draft.visitType))
    ) return null;
    return draft;
  } catch {
    return null;
  }
}

export function readVisitDraft(userId: string): VisitDraft | null {
  return readVisitDraftRecord(userId);
}

export function saveVisitDraft(userId: string, draft: VisitDraft): boolean {
  const store = storage();
  if (!store) return false;
  try {
    if (hasVisitDraftContent(draft)) {
      store.setItem(draftKey(userId), JSON.stringify({
        ...draft,
        version: DRAFT_VERSION,
        savedAt: new Date().toISOString(),
      } satisfies StoredDraft));
    } else {
      store.removeItem(draftKey(userId));
    }
    return true;
  } catch {
    return false;
  }
}

export function clearVisitDraft(userId: string): void {
  try {
    storage()?.removeItem(draftKey(userId));
  } catch {
    // Storage may be unavailable; the form still closes after a saved visit.
  }
}

export function isVisitFormOpen(userId: string): boolean {
  try {
    return storage()?.getItem(openKey(userId)) === "true";
  } catch {
    return false;
  }
}

export function setVisitFormOpen(userId: string, open: boolean): void {
  try {
    if (open) storage()?.setItem(openKey(userId), "true");
    else storage()?.removeItem(openKey(userId));
  } catch {
    // The form remains usable even when browser storage is disabled.
  }
}
