"use client";

import { useState, useEffect, useCallback } from "react";
import { AssignmentCard } from "./assignment-card";
import { AssignmentForm } from "./assignment-form";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Plus,
  CalendarCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VisitAssignmentWithDetails, AssignmentStatus } from "@/types";

type StatusFilter = "" | AssignmentStatus;

interface AssignmentListProps {
  assigneeId: string;
  /** Show assignee name on each card (for supervisor view) */
  showAssignee?: boolean;
}

export function AssignmentList({
  assigneeId,
  showAssignee = false,
}: AssignmentListProps) {
  const [assignments, setAssignments] = useState<VisitAssignmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VisitAssignmentWithDetails | null>(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (assigneeId) params.set("assignee_id", assigneeId);
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/assignments?${params}`);
      const data = await res.json();
      setAssignments(data.data || []);
    } finally {
      setLoading(false);
    }
  }, [assigneeId, statusFilter]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success("Planification supprimée");
      fetchAssignments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleEdit = (assignment: VisitAssignmentWithDetails) => {
    setEditing(assignment);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditing(null);
  };

  // Stats
  const allItems = assignments;
  const pendingCount = allItems.filter((a) => a.status === "pending").length;
  const overdueCount = allItems.filter((a) => a.status === "overdue").length;
  const completedCount = allItems.filter((a) => a.status === "completed").length;

  const tabs: { key: StatusFilter; label: string; count: number; icon: typeof Clock }[] = [
    { key: "", label: "Toutes", count: allItems.length, icon: ClipboardList },
    { key: "pending", label: "En attente", count: pendingCount, icon: Clock },
    { key: "overdue", label: "En retard", count: overdueCount, icon: AlertTriangle },
    { key: "completed", label: "Terminées", count: completedCount, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Stats pills */}
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
              <Clock className="h-3 w-3" />
              {pendingCount} en attente
            </span>
          )}
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
              <AlertTriangle className="h-3 w-3" />
              {overdueCount} en retard
            </span>
          )}
          {completedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-800 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
              <CheckCircle2 className="h-3 w-3" />
              {completedCount} terminée{completedCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          size="sm"
          className="cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1" />
          Planifier
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="grid grid-cols-4 gap-1.5 p-1 bg-muted/40 rounded-lg">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const active = statusFilter === tab.key;
          return (
            <button
              key={tab.key || "all"}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all cursor-pointer",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TabIcon className="h-3 w-3" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count > 0 && (
                <span className="text-[10px] opacity-60">({tab.count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-12">
          <CalendarCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">
            {statusFilter
              ? "Aucune planification avec ce filtre"
              : "Aucune visite planifiée"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              showAssignee={showAssignee}
              onEdit={a.status !== "completed" ? handleEdit : undefined}
              onDelete={a.status !== "completed" ? handleDelete : undefined}
            />
          ))}
        </div>
      )}

      {/* Form dialog */}
      <AssignmentForm
        open={formOpen}
        onOpenChange={handleFormClose}
        assigneeId={assigneeId}
        assignment={editing}
        onSuccess={fetchAssignments}
      />
    </div>
  );
}
