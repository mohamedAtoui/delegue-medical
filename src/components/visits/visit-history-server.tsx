"use client";

import { VisitEntry } from "./visit-entry";
import type { VisitWithDetails } from "@/types";

interface VisitHistoryServerProps {
  visits: VisitWithDetails[];
  showUser?: boolean;
}

export function VisitHistoryServer({
  visits,
  showUser = false,
}: VisitHistoryServerProps) {
  if (visits.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Aucune visite enregistrée</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visits.map((visit) => (
        <VisitEntry
          key={visit.id}
          visit={visit}
          showUser={showUser}
        />
      ))}
    </div>
  );
}
