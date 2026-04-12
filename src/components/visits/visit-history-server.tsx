"use client";

import { useState } from "react";
import { VisitEntry } from "./visit-entry";
import { VisitDetailDialog } from "./visit-detail-dialog";
import type { VisitWithDetails } from "@/types";

interface VisitHistoryServerProps {
  visits: VisitWithDetails[];
  showUser?: boolean;
}

export function VisitHistoryServer({
  visits,
  showUser = false,
}: VisitHistoryServerProps) {
  const [selectedVisit, setSelectedVisit] =
    useState<VisitWithDetails | null>(null);

  if (visits.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Aucune visite enregistrée</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {visits.map((visit) => (
          <VisitEntry
            key={visit.id}
            visit={visit}
            showUser={showUser}
            onClick={(v) => setSelectedVisit(v)}
          />
        ))}
      </div>

      <VisitDetailDialog
        visit={selectedVisit}
        open={!!selectedVisit}
        onOpenChange={(open) => !open && setSelectedVisit(null)}
      />
    </>
  );
}
