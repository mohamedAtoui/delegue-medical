"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Stethoscope,
  Pill,
  MapPin,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  History,
  Loader2,
} from "lucide-react";
import { VisitEntry } from "@/components/visits/visit-entry";
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
   * Skip the "Voir l'historique complet" footer button. Useful when the
   * parent context already shows the full history (e.g. doctor profile page).
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

  // Full doctor history (loaded on demand)
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyVisits, setHistoryVisits] = useState<VisitWithDetails[] | null>(null);
  const [historyLoadedOnce, setHistoryLoadedOnce] = useState(false);

  const lastVisit = visits[0];
  const totalComments = visits.reduce(
    (sum, v) => sum + (v.comment_count || 0),
    0
  );

  const isPharm = doctorType
    ? doctorType === "pharmacien"
    : visits[0]?.doctor?.doctor_type === "pharmacien" ||
      visits[0]?.visit_type === "pharmacien";
  const Icon = isPharm ? Pill : Stethoscope;
  const iconBg = isPharm ? "bg-accent/10" : "bg-primary/10";
  const iconColor = isPharm ? "text-accent" : "text-primary";

  // Visit IDs already shown in the current group (to dedupe history results)
  const visibleIds = new Set(visits.map((v) => v.id));

  // Visits in the history fetch that AREN'T already shown above
  const extraHistoryVisits = (historyVisits ?? []).filter(
    (v) => !visibleIds.has(v.id)
  );

  const loadHistory = async () => {
    if (!doctorId || historyLoadedOnce) {
      setHistoryOpen(!historyOpen);
      return;
    }
    setHistoryLoading(true);
    setHistoryOpen(true);
    try {
      const res = await fetch(
        `/api/visits?doctor_id=${doctorId}&all=true&limit=100`
      );
      const data = await res.json();
      setHistoryVisits(Array.isArray(data.data) ? data.data : []);
      setHistoryLoadedOnce(true);
    } catch {
      setHistoryVisits([]);
      setHistoryLoadedOnce(true);
    } finally {
      setHistoryLoading(false);
    }
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
                  {visits.length} visite{visits.length !== 1 ? "s" : ""}
                </span>
                {totalComments > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {totalComments}
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

        {/* Expanded: unified VisitEntry for each visit */}
        {expanded && (
          <div
            className="mt-4 pt-3 border-t border-border/50 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            {visits.map((visit) => (
              <VisitEntry
                key={visit.id}
                visit={visit}
                showUser={showUser}
                highlightUserId={highlightUserId}
                onClick={onVisitClick}
                userRole={userRole}
                onDelete={onVisitDelete}
                highlightVisitId={highlightVisitId}
              />
            ))}

            {/* History toggle — only when we have a doctorId AND the parent
                didn't disable it (e.g. doctor profile page already shows
                everything). */}
            {!hideHistoryToggle && doctorId && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadHistory();
                  }}
                  disabled={historyLoading}
                  className="w-full justify-between cursor-pointer text-xs h-8 border-dashed"
                >
                  <span className="flex items-center gap-2">
                    {historyLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <History className="h-3 w-3" />
                    )}
                    {historyLoadedOnce
                      ? extraHistoryVisits.length > 0
                        ? `${extraHistoryVisits.length} visite${
                            extraHistoryVisits.length > 1 ? "s" : ""
                          } supplémentaire${extraHistoryVisits.length > 1 ? "s" : ""}`
                        : "Aucune autre visite"
                      : "Voir l'historique complet de ce médecin"}
                  </span>
                  {historyOpen ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>

                {historyOpen && historyLoadedOnce && extraHistoryVisits.length > 0 && (
                  <div className="mt-2 space-y-2 pl-3 border-l-2 border-primary/20">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 font-semibold">
                      Visites précédentes
                    </p>
                    {extraHistoryVisits.map((visit) => (
                      <VisitEntry
                        key={visit.id}
                        visit={visit}
                        showUser={showUser}
                        highlightUserId={highlightUserId}
                        userRole={userRole}
                        onDelete={onVisitDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
