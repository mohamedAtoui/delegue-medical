"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Clock, MessageSquare, Target, FileText } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
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
  const [selectedVisit, setSelectedVisit] = useState<VisitWithDetails | null>(null);

  if (visits.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Aucune visite enregistrée</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {visits.map((visit, index) => (
          <div
            key={visit.id}
            className="relative pl-6 cursor-pointer"
            onClick={() => setSelectedVisit(visit)}
          >
            {index < visits.length - 1 && (
              <div className="absolute left-[9px] top-6 bottom-0 w-px bg-border" />
            )}
            <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-primary bg-background flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>

            <div className="pb-3 rounded-lg p-2 -ml-1 hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {showUser && visit.user && (
                    <div className="flex items-center gap-1.5">
                      <UserAvatar
                        firstName={visit.user.first_name}
                        lastName={visit.user.last_name}
                        imageUrl={visit.user.avatar_url}
                        size="sm"
                      />
                      <span className="font-bold text-foreground/80">
                        {visit.user.first_name} {visit.user.last_name}
                      </span>
                    </div>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(visit.created_at), "d MMM yyyy à HH:mm", { locale: fr })}
                  </span>
                </div>
                {(visit.comment_count ?? 0) > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {visit.comment_count}
                  </Badge>
                )}
              </div>

              {visit.objective && (
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  {visit.objective}
                </p>
              )}
              {visit.compte_rendu ? (
                <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 rounded-lg p-3">
                  <FileText className="inline h-3 w-3 mr-1 text-muted-foreground" />
                  <span className="line-clamp-3">{visit.compte_rendu}</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Visite sans compte rendu
                </p>
              )}
            </div>
          </div>
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
