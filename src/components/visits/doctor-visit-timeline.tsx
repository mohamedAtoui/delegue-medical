"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  History,
  Clock,
  FileText,
  ChevronDown,
  Check,
  X,
  Target,
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { InlineComments } from "@/components/visits/visit-card";
import { cn } from "@/lib/utils";
import type { VisitWithDetails } from "@/types";

interface DoctorVisitTimelineProps {
  doctorId: string;
  refreshKey?: number;
}

function MiniYesNo({ value, label }: { value: boolean | null; label: string }) {
  if (value === null || value === undefined) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px]">
      {value ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <X className="h-3 w-3 text-red-500" />
      )}
      <span className="text-foreground/70">{label}</span>
    </span>
  );
}

function VisitEntry({ visit }: { visit: VisitWithDetails }) {
  const [open, setOpen] = useState(false);
  const isPharm = visit.visit_type === "pharmacien";

  // Count non-null boolean fields for the evaluation summary
  const evalFields = [
    visit.synapgen_solves,
    visit.already_prescribed,
    visit.promised_to_suggest,
    visit.price_objection,
    visit.prescribes_magnesium,
    visit.fears_side_effects,
    visit.patient_feedback,
    visit.ordonnance_return,
    visit.free_sample,
  ];
  const answeredCount = evalFields.filter((v) => v !== null && v !== undefined).length;
  const yesCount = evalFields.filter((v) => v === true).length;

  return (
    <div className="rounded-xl border border-border/60 bg-background/80 overflow-hidden transition-shadow hover:shadow-sm">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 p-3 text-left cursor-pointer hover:bg-muted/20 transition-colors"
      >
        <UserAvatar
          firstName={visit.user?.first_name}
          lastName={visit.user?.last_name}
          imageUrl={visit.user?.avatar_url}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-foreground/85">
              {visit.user?.first_name} {visit.user?.last_name}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
              <Clock className="h-3 w-3" />
              {format(new Date(visit.created_at), "d MMM yyyy · HH:mm", {
                locale: fr,
              })}
            </span>
          </div>

          {/* One-line preview when closed */}
          {!open && (
            <p className="text-xs text-foreground/60 mt-0.5 line-clamp-1">
              {visit.objective || visit.compte_rendu || (isPharm ? "Visite pharmacien" : "Visite médecin")}
            </p>
          )}

          {/* Badges row */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {(visit.comment_count ?? 0) > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-normal">
                <MessageSquare className="h-2.5 w-2.5" />
                {visit.comment_count}
              </Badge>
            )}
            {!isPharm && answeredCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-normal">
                {yesCount}/{answeredCount} oui
              </Badge>
            )}
            {isPharm && visit.synapgen_count != null && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-normal">
                Stock: {visit.synapgen_count}
              </Badge>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-border/40 pt-2.5">
          {/* Objective */}
          {visit.objective && (
            <div className="flex items-start gap-1.5">
              <Target className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-foreground/70">
                <span className="font-semibold text-foreground/80">Objectif : </span>
                {visit.objective}
              </p>
            </div>
          )}

          {/* Compte rendu */}
          {visit.compte_rendu && (
            <div className="flex items-start gap-1.5">
              <FileText className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {visit.compte_rendu}
              </p>
            </div>
          )}

          {/* Médecin evaluation summary */}
          {!isPharm && answeredCount > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 pl-4 pt-1">
              <MiniYesNo value={visit.synapgen_solves} label="Synapgen résout" />
              <MiniYesNo value={visit.already_prescribed} label="Déjà prescrit" />
              <MiniYesNo value={visit.promised_to_suggest} label="Promis suggérer" />
              <MiniYesNo value={visit.price_objection} label="Objection prix" />
              <MiniYesNo value={visit.prescribes_magnesium} label="Magnésium" />
              <MiniYesNo value={visit.fears_side_effects} label="Effets sec." />
              <MiniYesNo value={visit.patient_feedback} label="Retour patients" />
              <MiniYesNo value={visit.ordonnance_return} label="Retour ordonnance" />
              <MiniYesNo value={visit.free_sample} label="Échantillon" />
              {visit.magnesium_brand && (
                <span className="text-[11px] text-foreground/60 italic">
                  Marque : {visit.magnesium_brand}
                </span>
              )}
              {visit.patient_feedback_comment && (
                <span className="text-[11px] text-foreground/60 italic">
                  « {visit.patient_feedback_comment} »
                </span>
              )}
            </div>
          )}

          {/* Pharmacien details */}
          {isPharm && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pl-4 pt-1 text-[11px]">
              {visit.synapgen_count != null && (
                <span className="text-foreground/70">
                  <span className="font-semibold">Stock :</span> {visit.synapgen_count}
                </span>
              )}
              {visit.prescriptions_received != null && (
                <span className="text-foreground/70">
                  <span className="font-semibold">Prescriptions :</span> {visit.prescriptions_received}
                </span>
              )}
              {visit.prescribing_doctor && (
                <span className="text-foreground/70">
                  <span className="font-semibold">Prescripteur :</span> {visit.prescribing_doctor}
                </span>
              )}
              {visit.accepted_order != null && (
                <MiniYesNo value={visit.accepted_order} label="Commande acceptée" />
              )}
            </div>
          )}

          {/* Comments */}
          <InlineComments visitId={visit.id} visitAuthorId={visit.user_id} />
        </div>
      )}
    </div>
  );
}

export function DoctorVisitTimeline({
  doctorId,
  refreshKey = 0,
}: DoctorVisitTimelineProps) {
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/visits?doctor_id=${doctorId}&all=true&limit=20`
      );
      const data = await res.json();
      setVisits(data.data || []);
    } catch {
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-12 rounded-lg bg-muted/30 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="text-center py-5 text-sm text-muted-foreground">
        <History className="h-7 w-7 mx-auto mb-1.5 opacity-30" />
        Première visite pour ce{" "}
        {visits.length === 0 ? "professionnel" : "médecin"}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setHistoryOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground/85">
          <History className="h-4 w-4 text-primary/70" />
          Historique
          <span className="text-xs font-normal text-muted-foreground">
            · {visits.length} visite{visits.length > 1 ? "s" : ""}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            historyOpen && "rotate-180"
          )}
        />
      </button>

      {/* Expanded visit list */}
      {historyOpen && (
        <div className="px-3 pb-3 space-y-2 max-h-[420px] overflow-y-auto border-t border-border/40">
          <div className="pt-2 space-y-2">
            {visits.map((visit) => (
              <VisitEntry key={visit.id} visit={visit} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
