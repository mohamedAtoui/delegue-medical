"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope,
  Pill,
  Truck,
  MapPin,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { VisitEntry } from "@/components/visits/visit-entry";
import { EngagementStars } from "@/components/shared/engagement-stars";
import type { VisitWithDetails, DoctorType, Potentiel } from "@/types";

// Re-export for backward compat
export { InlineComments } from "@/components/visits/visit-entry";

interface DoctorVisitGroupProps {
  doctorId?: string;
  doctorName: string;
  specialty: string | null;
  wilaya: string;
  commune?: string | null;
  address?: string | null;
  potentiel?: Potentiel | null;
  visits: VisitWithDetails[];
  doctorType?: DoctorType;
  showUser?: boolean;
  highlightUserId?: string;
  onVisitClick?: (visit: VisitWithDetails) => void;
  userRole?: string;
  onVisitDelete?: (visitId: string) => void;
  /** Auto-expand if this id matches one of our visits */
  highlightVisitId?: string;
  /**
   * Skip auto-fetching the full doctor history on expand. Use when the
   * parent already passes in the complete visit list (e.g. doctor profile).
   */
  hideHistoryToggle?: boolean;
}

export function DoctorVisitGroup({
  doctorId,
  doctorName,
  specialty,
  wilaya,
  commune,
  address,
  potentiel,
  visits,
  doctorType,
  showUser = false,
  highlightUserId,
  onVisitClick,
  highlightVisitId,
  userRole,
  onVisitDelete,
  hideHistoryToggle = false,
}: DoctorVisitGroupProps) {
  // Auto-expand on initial mount if a highlighted visit belongs to this group
  const [expanded, setExpanded] = useState<boolean>(() =>
    !!(highlightVisitId && visits.some((v) => v.id === highlightVisitId))
  );

  // Full doctor history — fetched automatically the first time we expand.
  const [allVisits, setAllVisits] = useState<VisitWithDetails[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [localDeletedIds, setLocalDeletedIds] = useState<Set<string>>(new Set());

  // Auto-fetch full history when expanded, unless parent disables it
  useEffect(() => {
    if (!expanded || hideHistoryToggle || !doctorId || allVisits !== null) return;
    let cancelled = false;
    setLoadingAll(true);
    fetch(`/api/visits?doctor_id=${doctorId}&all=true&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setAllVisits(Array.isArray(data.data) ? data.data : []);
      })
      .catch(() => {
        if (!cancelled) setAllVisits([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAll(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, hideHistoryToggle, doctorId, allVisits]);

  const lastVisit = visits[0];
  const totalComments = visits.reduce(
    (sum, v) => sum + (v.comment_count || 0),
    0
  );
  // True total visits for this doctor (server-computed), independent of the
  // filtered/paginated page. Falls back to the page length if not provided.
  const doctorVisitCount = visits[0]?.doctor_visit_count ?? visits.length;
  const doctorEngagement = visits[0]?.doctor?.engagement ?? null;

  const effectiveType =
    doctorType ?? visits[0]?.doctor?.doctor_type ?? visits[0]?.visit_type;
  const isGross = effectiveType === "grossiste";
  const isPrescriber = effectiveType === "medecin";
  const Icon = isGross ? Truck : isPrescriber ? Stethoscope : Pill;
  const iconBg = isPrescriber ? "bg-primary/10" : "bg-accent/10";
  const iconColor = isPrescriber ? "text-primary" : "text-accent";

  // Pick the list to display:
  //   - if we've fetched the full history, use that
  //   - otherwise fall back to the filtered visits passed in by the parent
  const rawList = (allVisits ?? visits).filter((v) => !localDeletedIds.has(v.id));

  // Number each visit chronologically (1 = oldest, N = most recent)
  const ascending = [...rawList].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const visitNumber = new Map<string, number>();
  ascending.forEach((v, i) => visitNumber.set(v.id, i + 1));

  // Display in reverse-chronological order (most recent first)
  const displayList = [...rawList].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Wrap parent's onDelete so this component keeps its own list in sync too
  const handleDelete = (visitId: string) => {
    setLocalDeletedIds((prev) => new Set(prev).add(visitId));
    onVisitDelete?.(visitId);
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all"
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}
            >
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {doctorId ? (
                  <Link
                    href={`/medecins/${doctorId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-sm hover:underline cursor-pointer"
                  >
                    {doctorName}
                  </Link>
                ) : (
                  <span className="font-semibold text-sm">{doctorName}</span>
                )}
                {specialty && (
                  <Badge variant="secondary" className="text-xs">
                    {specialty}
                  </Badge>
                )}
                {doctorEngagement != null && doctorEngagement > 0 && (
                  <EngagementStars
                    value={doctorEngagement}
                    size="sm"
                    showValue
                  />
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1 min-w-0">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {wilaya}
                    {commune ? `, ${commune}` : ""}
                    {address ? ` — ${address}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {doctorVisitCount} visite{doctorVisitCount !== 1 ? "s" : ""}
                </span>
                {totalComments > 0 && (
                  <span
                    className="flex items-center gap-1"
                    title={`${totalComments} commentaire${totalComments !== 1 ? "s" : ""}`}
                  >
                    <MessageSquare className="h-3 w-3" />
                    {totalComments} comm.
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(lastVisit.created_at), "d MMM", {
                    locale: fr,
                  })}
                </span>
                {potentiel && (
                  <Badge
                    className={`text-xs px-1.5 py-0 ${
                      potentiel === "A"
                        ? "bg-green-100 text-green-700 hover:bg-green-100"
                        : potentiel === "B"
                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                        : "bg-red-100 text-red-700 hover:bg-red-100"
                    }`}
                  >
                    {potentiel}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0">
            {expanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Expanded: every visit (filtered + auto-fetched history), numbered. */}
        {expanded && (
          <div
            className="mt-4 pt-3 border-t border-border/50 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* History summary header */}
            {!hideHistoryToggle && doctorId && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-1">
                <span className="font-semibold uppercase tracking-wide">
                  Historique complet
                </span>
                {loadingAll ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Chargement…
                  </span>
                ) : (
                  <span>
                    {displayList.length} visite{displayList.length > 1 ? "s" : ""} au total
                  </span>
                )}
              </div>
            )}

            {/* Visits — newest first, with chronological number */}
            {displayList.map((visit) => {
              const num = visitNumber.get(visit.id);
              return (
                <div key={visit.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                      #{num}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Visite #{num} sur {displayList.length}
                    </span>
                  </div>
                  <VisitEntry
                    visit={visit}
                    showUser={showUser}
                    highlightUserId={highlightUserId}
                    onClick={onVisitClick}
                    userRole={userRole}
                    onDelete={handleDelete}
                    highlightVisitId={highlightVisitId}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
