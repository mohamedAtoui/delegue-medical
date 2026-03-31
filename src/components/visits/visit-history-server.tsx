"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { User, Clock } from "lucide-react";
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
    <div className="space-y-3">
      {visits.map((visit, index) => (
        <div key={visit.id} className="relative pl-6">
          {index < visits.length - 1 && (
            <div className="absolute left-[9px] top-6 bottom-0 w-px bg-border" />
          )}
          <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-primary bg-background flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-primary" />
          </div>

          <div className="pb-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {showUser && visit.user && (
                  <span className="flex items-center gap-1 font-medium text-foreground/70">
                    <User className="h-3 w-3" />
                    {visit.user.first_name} {visit.user.last_name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(visit.created_at), "d MMM yyyy à HH:mm", { locale: fr })}
                </span>
              </div>
              <Badge variant="outline" className="text-xs">
                {visit.product?.name}
              </Badge>
            </div>

            {visit.notes ? (
              <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 rounded-lg p-3">
                {visit.notes}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Visite sans commentaire
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
