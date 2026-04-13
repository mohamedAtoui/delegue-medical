"use client";

import { format, formatDistanceToNow, isPast } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  Stethoscope,
  Pill,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Trash2,
  FileText,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VisitAssignmentWithDetails } from "@/types";

interface AssignmentCardProps {
  assignment: VisitAssignmentWithDetails;
  onEdit?: (assignment: VisitAssignmentWithDetails) => void;
  onDelete?: (id: string) => void;
  showAssignee?: boolean;
}

export function AssignmentCard({
  assignment,
  onEdit,
  onDelete,
  showAssignee = false,
}: AssignmentCardProps) {
  const isPharm = assignment.doctor?.doctor_type === "pharmacien";
  const Icon = isPharm ? Pill : Stethoscope;
  const iconColor = isPharm ? "text-accent" : "text-primary";
  const iconBg = isPharm ? "bg-accent/10" : "bg-primary/10";

  const deadlineDate = new Date(assignment.deadline);
  const isOverdue = assignment.status === "overdue" || (assignment.status === "pending" && isPast(deadlineDate));
  const isCompleted = assignment.status === "completed";
  const isSelfAssigned = assignment.assignee_id === assignment.assigned_by;

  const deadlineText = isCompleted
    ? `Terminée le ${format(new Date(assignment.completed_at!), "d MMM yyyy", { locale: fr })}`
    : isOverdue
    ? `En retard de ${formatDistanceToNow(deadlineDate, { locale: fr })}`
    : `Dans ${formatDistanceToNow(deadlineDate, { locale: fr })}`;

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden transition-all",
        isCompleted
          ? "border-green-200/60 bg-green-50/30"
          : isOverdue
          ? "border-red-200/60 bg-red-50/20"
          : "border-border/60 bg-background hover:shadow-sm"
      )}
    >
      <div className="p-3.5">
        {/* Top row: doctor info */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full mt-0.5",
              iconBg
            )}
          >
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {isPharm ? "" : "Dr. "}
                  {assignment.doctor?.last_name} {assignment.doctor?.first_name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {assignment.doctor?.specialty && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {assignment.doctor.specialty}
                    </Badge>
                  )}
                  <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {assignment.doctor?.wilaya}
                  </span>
                </div>
              </div>

              {/* Status badge */}
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-2 py-0.5 shrink-0",
                  isCompleted
                    ? "bg-green-100 text-green-800 border-green-300"
                    : isOverdue
                    ? "bg-red-100 text-red-800 border-red-300"
                    : "bg-amber-50 text-amber-800 border-amber-300"
                )}
              >
                {isCompleted ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" />Terminée</>
                ) : isOverdue ? (
                  <><AlertTriangle className="h-3 w-3 mr-1" />En retard</>
                ) : (
                  <><Clock className="h-3 w-3 mr-1" />En attente</>
                )}
              </Badge>
            </div>

            {/* Deadline */}
            <div
              className={cn(
                "flex items-center gap-1.5 mt-2 text-xs",
                isOverdue
                  ? "text-red-700 font-medium"
                  : isCompleted
                  ? "text-green-700"
                  : "text-foreground/70"
              )}
            >
              <Clock className="h-3 w-3" />
              {deadlineText}
              {!isCompleted && (
                <span className="text-muted-foreground/60">
                  · {format(deadlineDate, "d MMM yyyy", { locale: fr })}
                </span>
              )}
            </div>

            {/* Note */}
            {assignment.note && (
              <div className="flex items-start gap-1.5 mt-2">
                <FileText className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-foreground/60 line-clamp-2">
                  {assignment.note}
                </p>
              </div>
            )}

            {/* Footer: assigned by + actions */}
            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/30">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {showAssignee ? (
                  <>
                    <UserAvatar
                      firstName={assignment.assignee?.first_name}
                      lastName={assignment.assignee?.last_name}
                      imageUrl={assignment.assignee?.avatar_url}
                      size="sm"
                    />
                    <span>
                      {assignment.assignee?.first_name} {assignment.assignee?.last_name}
                    </span>
                  </>
                ) : isSelfAssigned ? (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Auto-planifié
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <UserAvatar
                      firstName={assignment.assigner?.first_name}
                      lastName={assignment.assigner?.last_name}
                      imageUrl={assignment.assigner?.avatar_url}
                      size="sm"
                    />
                    par {assignment.assigner?.first_name} {assignment.assigner?.last_name}
                  </span>
                )}
              </div>

              {!isCompleted && (
                <div className="flex items-center gap-1">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(assignment)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Modifier"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(assignment.id)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors cursor-pointer"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
