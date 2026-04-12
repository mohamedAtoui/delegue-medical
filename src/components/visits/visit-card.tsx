"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope,
  Pill,
  MapPin,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
} from "lucide-react";
import { VisitEntry } from "@/components/visits/visit-entry";
import { cn } from "@/lib/utils";
import type { VisitWithDetails, DoctorType } from "@/types";

// Re-export for backward compat
export { InlineComments } from "@/components/visits/visit-entry";

interface DoctorVisitGroupProps {
  doctorName: string;
  specialty: string | null;
  wilaya: string;
  visits: VisitWithDetails[];
  doctorType?: DoctorType;
  showUser?: boolean;
  highlightUserId?: string;
  onVisitClick?: (visit: VisitWithDetails) => void;
}

export function DoctorVisitGroup({
  doctorName,
  specialty,
  wilaya,
  visits,
  doctorType,
  showUser = false,
  highlightUserId,
  onVisitClick,
}: DoctorVisitGroupProps) {
  const [expanded, setExpanded] = useState(false);
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
                <span className="font-semibold text-sm">{doctorName}</span>
                {specialty && (
                  <Badge variant="secondary" className="text-xs">
                    {specialty}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {wilaya}
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
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
