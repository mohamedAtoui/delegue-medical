"use client";

import { useState } from "react";
import { Clock, Lock, Pencil, Check, X, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TIMING_STAGES, STAGE_LABELS, formatDuration } from "@/lib/timings";
import type { TimingStage, VisitTiming, VisitTimingAudit } from "@/types";

interface VisitTimingsViewProps {
  visitId: string;
  timings: VisitTiming[];
  userRole?: string;
  onUpdated?: () => void;
}

/**
 * Read-only view of a visit's stage timings. Superviseurs can correct a
 * duration inline (each correction is audited server-side) and inspect the
 * full correction history. Délégués only see the recorded values — they can
 * never edit them.
 */
export function VisitTimingsView({
  visitId,
  timings,
  userRole,
  onUpdated,
}: VisitTimingsViewProps) {
  const isSupervisor = userRole === "superviseur";
  const byStage = new Map(timings.map((t) => [t.stage, t]));

  const [editStage, setEditStage] = useState<TimingStage | null>(null);
  const [editMin, setEditMin] = useState("");
  const [editSec, setEditSec] = useState("");
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);

  const [showAudit, setShowAudit] = useState(false);
  const [audits, setAudits] = useState<VisitTimingAudit[] | null>(null);

  const total = timings.reduce((s, t) => s + (t.duration_seconds || 0), 0);

  // Délégués only see stages that were actually recorded.
  const stagesToShow = isSupervisor
    ? TIMING_STAGES
    : TIMING_STAGES.filter((s) => byStage.has(s));

  if (stagesToShow.length === 0) return null;

  const openEdit = (stage: TimingStage) => {
    const t = byStage.get(stage);
    const secs = t?.duration_seconds ?? 0;
    setEditStage(stage);
    setEditMin(String(Math.floor(secs / 60)));
    setEditSec(String(secs % 60));
    setEditReason("");
  };

  const save = async (stage: TimingStage) => {
    const min = parseInt(editMin || "0", 10) || 0;
    const sec = parseInt(editSec || "0", 10) || 0;
    const duration = min * 60 + sec;
    setSaving(true);
    try {
      const res = await fetch(`/api/visits/${visitId}/timings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          duration_seconds: duration,
          reason: editReason || null,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error);
      }
      toast.success("Durée corrigée");
      setEditStage(null);
      setAudits(null); // force refetch next time
      onUpdated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const loadAudits = async () => {
    setShowAudit((v) => !v);
    if (audits === null) {
      try {
        const res = await fetch(`/api/visits/${visitId}/timings`);
        const data = await res.json();
        setAudits(Array.isArray(data.audits) ? data.audits : []);
      } catch {
        setAudits([]);
      }
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Clock className="h-3 w-3" />
        Temps de visite
        {total > 0 && (
          <span className="ml-auto normal-case tracking-normal text-foreground/70">
            Total : {formatDuration(total)}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {stagesToShow.map((stage) => {
          const t = byStage.get(stage);
          const editing = editStage === stage;
          return (
            <div
              key={stage}
              className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1.5 text-xs"
            >
              <span className="w-28 shrink-0 text-foreground/70">
                {STAGE_LABELS[stage]}
              </span>

              {editing ? (
                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  <Input
                    type="number"
                    min="0"
                    value={editMin}
                    onChange={(e) => setEditMin(e.target.value)}
                    className="h-7 w-14"
                    placeholder="min"
                  />
                  <span className="text-muted-foreground">min</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={editSec}
                    onChange={(e) => setEditSec(e.target.value)}
                    className="h-7 w-14"
                    placeholder="s"
                  />
                  <span className="text-muted-foreground">s</span>
                  <Input
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="h-7 flex-1 min-w-[7rem]"
                    placeholder="Motif (optionnel)"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={() => save(stage)}
                    className="h-7 cursor-pointer px-2"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditStage(null)}
                    className="h-7 cursor-pointer px-2"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 font-medium text-foreground">
                    {t ? formatDuration(t.duration_seconds) : "Non enregistré"}
                    {t && (
                      <span className="ml-1.5 rounded bg-muted px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t.mode === "auto" ? "chrono" : "manuel"}
                      </span>
                    )}
                  </span>
                  {isSupervisor ? (
                    <button
                      type="button"
                      onClick={() => openEdit(stage)}
                      className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Corriger"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <Lock className="h-3 w-3 text-muted-foreground/60" />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {isSupervisor && (
        <div>
          <button
            type="button"
            onClick={loadAudits}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <History className="h-3 w-3" />
            {showAudit ? "Masquer" : "Historique des corrections"}
            {audits && audits.length > 0 ? ` (${audits.length})` : ""}
          </button>
          {showAudit && (
            <div className="mt-1 space-y-1">
              {audits === null ? (
                <p className="text-[11px] text-muted-foreground">Chargement…</p>
              ) : audits.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Aucune correction.
                </p>
              ) : (
                audits.map((a) => (
                  <p key={a.id} className="text-[11px] text-muted-foreground">
                    {format(new Date(a.created_at), "d MMM yyyy HH:mm", {
                      locale: fr,
                    })}{" "}
                    — {STAGE_LABELS[a.stage]} :{" "}
                    {a.old_duration_seconds != null
                      ? formatDuration(a.old_duration_seconds)
                      : "—"}{" "}
                    →{" "}
                    {a.new_duration_seconds != null
                      ? formatDuration(a.new_duration_seconds)
                      : "—"}
                    {a.editor
                      ? ` · ${a.editor.first_name ?? ""} ${a.editor.last_name ?? ""}`.trimEnd()
                      : ""}
                    {a.reason ? ` · « ${a.reason} »` : ""}
                  </p>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
