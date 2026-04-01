"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope,
  MapPin,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  MessageSquare,
} from "lucide-react";
import type { VisitWithDetails } from "@/types";

interface DoctorVisitGroupProps {
  doctorName: string;
  specialty: string | null;
  wilaya: string;
  visits: VisitWithDetails[];
  showUser?: boolean;
}

export function DoctorVisitGroup({
  doctorName,
  specialty,
  wilaya,
  visits,
  showUser = false,
}: DoctorVisitGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const lastVisit = visits[0];
  const commentCount = visits.filter((v) => v.notes).length;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all"
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{doctorName}</span>
                {specialty && (
                  <Badge variant="secondary" className="text-xs">
                    {specialty}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {wilaya}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {commentCount} commentaire{commentCount !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(lastVisit.created_at), "d MMM", { locale: fr })}
                </span>
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

        {/* Expanded: timeline of all visits */}
        {expanded && (
          <div className="mt-4 pt-3 border-t border-border/50">
            <div className="space-y-3">
              {visits.map((visit, index) => (
                <div
                  key={visit.id}
                  className="relative pl-6"
                >
                  {/* Timeline line */}
                  {index < visits.length - 1 && (
                    <div className="absolute left-[9px] top-6 bottom-0 w-px bg-border" />
                  )}
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-primary bg-background flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>

                  {/* Visit content */}
                  <div className="pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {visit.user && (
                          <span className="flex items-center gap-1 font-medium text-foreground/70">
                            <User className="h-3 w-3" />
                            {visit.user.first_name} {visit.user.last_name}
                          </span>
                        )}
                        <span>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
