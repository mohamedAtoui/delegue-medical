"use client";

import { useState, useEffect, useCallback } from "react";
import { History, ChevronDown } from "lucide-react";
import { VisitEntry } from "@/components/visits/visit-entry";
import { cn } from "@/lib/utils";
import type { VisitWithDetails } from "@/types";

interface DoctorVisitTimelineProps {
  doctorId: string;
  refreshKey?: number;
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
        Première visite pour ce professionnel
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

      {/* Expanded visit list — same VisitEntry used everywhere */}
      {historyOpen && (
        <div className="px-3 pb-3 space-y-2 max-h-[420px] overflow-y-auto border-t border-border/40">
          <div className="pt-2 space-y-2">
            {visits.map((visit) => (
              <VisitEntry key={visit.id} visit={visit} showUser />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
