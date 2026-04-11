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
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import type { VisitWithDetails, DoctorType } from "@/types";

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
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
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
              {visits.map((visit, index) => {
                const isHighlighted =
                  !highlightUserId || visit.user_id === highlightUserId;
                const summary =
                  visit.objective ||
                  visit.compte_rendu ||
                  (visit.visit_type === "pharmacien"
                    ? "Visite pharmacien"
                    : "Visite médecin");

                return (
                  <div
                    key={visit.id}
                    className="relative pl-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVisitClick?.(visit);
                    }}
                  >
                    {/* Timeline line */}
                    {index < visits.length - 1 && (
                      <div className="absolute left-[9px] top-6 bottom-0 w-px bg-border" />
                    )}

                    {/* Timeline dot */}
                    <div
                      className={cn(
                        "absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 bg-background flex items-center justify-center",
                        isHighlighted ? "border-primary" : "border-muted-foreground/30"
                      )}
                    >
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          isHighlighted ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                      />
                    </div>

                    <div
                      className={cn(
                        "pb-3 rounded-lg px-3 py-2 -ml-1 cursor-pointer transition-colors",
                        onVisitClick && "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                        <div className="flex items-center gap-2 text-xs">
                          {showUser && visit.user && (
                            <div className="flex items-center gap-1">
                              <UserAvatar
                                firstName={visit.user.first_name}
                                lastName={visit.user.last_name}
                                imageUrl={visit.user.avatar_url}
                                size="sm"
                              />
                              <span
                                className={cn(
                                  "font-bold",
                                  isHighlighted ? "text-green-700" : "text-foreground"
                                )}
                              >
                                {visit.user.first_name} {visit.user.last_name}
                              </span>
                            </div>
                          )}
                          <span className="text-muted-foreground">
                            {format(new Date(visit.created_at), "d MMM yyyy à HH:mm", {
                              locale: fr,
                            })}
                          </span>
                        </div>
                        {(visit.comment_count ?? 0) > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {visit.comment_count}
                          </Badge>
                        )}
                      </div>

                      <p
                        className={cn(
                          "text-sm leading-relaxed rounded-lg p-3",
                          isHighlighted
                            ? "bg-green-50 border border-green-200 text-green-900"
                            : "bg-muted/30 text-foreground/80"
                        )}
                      >
                        <span className="line-clamp-3">{summary}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
