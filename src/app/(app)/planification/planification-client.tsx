"use client";

import { useSearchParams } from "next/navigation";
import { AssignmentList } from "@/components/assignments/assignment-list";
import { CalendarCheck } from "lucide-react";
import type { VisitAssignmentWithDetails } from "@/types";

interface PlanificationClientProps {
  userId: string;
  initialAssignments?: VisitAssignmentWithDetails[];
}

export function PlanificationClient({
  userId,
  initialAssignments,
}: PlanificationClientProps) {
  const searchParams = useSearchParams();
  const highlightAssignmentId = searchParams.get("assignment") || undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CalendarCheck className="h-6 w-6 text-primary" />
          Ma planification
        </h1>
        <p className="text-sm text-muted-foreground">
          Planifiez et suivez vos visites à venir
        </p>
      </div>

      <AssignmentList
        assigneeId={userId}
        initialAssignments={initialAssignments}
        highlightAssignmentId={highlightAssignmentId}
      />
    </div>
  );
}
