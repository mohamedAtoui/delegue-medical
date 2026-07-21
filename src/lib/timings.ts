import type { TimingStage } from "@/types";

/** Current epoch ms. Indirection keeps chronometer event handlers out of the
 *  react-compiler's "impure call during render" false positives. */
export const nowMs = (): number => Date.now();

export const TIMING_STAGES: TimingStage[] = ["trajet", "attente", "visite"];

export const STAGE_LABELS: Record<TimingStage, string> = {
  trajet: "Trajet",
  attente: "Salle d'attente",
  visite: "Visite",
};

/** "1 h 05 min", "12 min 30 s", "45 s". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return sec > 0 ? `${m} min ${String(sec).padStart(2, "0")} s` : `${m} min`;
  return `${sec} s`;
}

/** Live "MM:SS" (or "H:MM:SS") for a running chronometer. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
