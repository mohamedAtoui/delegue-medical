"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageSquare, User, Clock } from "lucide-react";
import type { VisitWithDetails } from "@/types";

interface DoctorVisitTimelineProps {
  doctorId: string;
  refreshKey?: number;
}

export function DoctorVisitTimeline({ doctorId, refreshKey = 0 }: DoctorVisitTimelineProps) {
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/visits?doctor_id=${doctorId}&all=true&limit=50`);
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
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Première visite avec ce médecin
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Historique ({visits.length} visite{visits.length > 1 ? "s" : ""})
      </p>
      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
        {visits.map((visit) => (
          <div
            key={visit.id}
            className="relative rounded-lg border border-border/50 bg-muted/20 p-3"
          >
            {/* Header: who + when */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="font-medium">
                  {visit.user?.first_name} {visit.user?.last_name}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(new Date(visit.created_at), "d MMM yyyy à HH:mm", { locale: fr })}
              </div>
            </div>

            {/* Notes */}
            {visit.notes ? (
              <p className="text-sm text-foreground/90 leading-relaxed">
                {visit.notes}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Aucune note
              </p>
            )}

            {/* Product badge */}
            <div className="mt-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {visit.product?.name}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
