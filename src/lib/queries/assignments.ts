import { createClient } from "@/utils/supabase/server";
import type { UserRole, VisitAssignmentWithDetails } from "@/types";

export interface AssignmentQueryOptions {
  currentUserId: string;
  currentUserRole: UserRole;
  assigneeId?: string | null;
  status?: "pending" | "completed" | "overdue" | null;
  page?: number;
  limit?: number;
}

export interface AssignmentsResult {
  data: VisitAssignmentWithDetails[];
  count: number;
  page: number;
  limit: number;
}

/**
 * Shared visit_assignments query. Computes overdue status from `pending` rows
 * whose deadline has passed.
 */
export async function fetchAssignments(
  opts: AssignmentQueryOptions
): Promise<AssignmentsResult> {
  const {
    currentUserId,
    currentUserRole,
    assigneeId,
    status,
    page = 1,
    limit = 50,
  } = opts;

  const offset = (page - 1) * limit;
  const supabase = await createClient();

  let query = supabase
    .from("visit_assignments")
    .select(
      `*, doctor:doctors(*), assignee:users!visit_assignments_assignee_id_fkey(id, first_name, last_name, avatar_url), assigner:users!visit_assignments_assigned_by_fkey(id, first_name, last_name, avatar_url)`,
      { count: "exact" }
    );

  if (currentUserRole === "delegue") {
    query = query.eq("assignee_id", currentUserId);
  } else if (assigneeId) {
    query = query.eq("assignee_id", assigneeId);
  }

  if (status === "completed") {
    query = query.eq("status", "completed");
  } else if (status === "pending" || status === "overdue") {
    query = query.eq("status", "pending");
  }

  const { data, count, error } = await query
    .order("deadline", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  const now = new Date();
  const enriched = (data || []).map((item) => ({
    ...item,
    status:
      item.status === "pending" && new Date(item.deadline) < now
        ? "overdue"
        : item.status,
  })) as VisitAssignmentWithDetails[];

  let filtered = enriched;
  if (status === "overdue") {
    filtered = enriched.filter((item) => item.status === "overdue");
  } else if (status === "pending") {
    filtered = enriched.filter((item) => item.status === "pending");
  }

  return {
    data: filtered,
    count: count || 0,
    page,
    limit,
  };
}
