import { createClient } from "@/utils/supabase/server";
import type { VisitWithDetails } from "@/types";

export interface VisitQueryOptions {
  /** When false, restricts to currentUserId. When true, returns all visits (supervisor view). */
  all?: boolean;
  currentUserId?: string;
  userFilter?: string | null;
  doctorId?: string | null;
  from?: string | null;
  to?: string | null;
  type?: "medecin" | "pharmacien" | null;
  wilaya?: string | null;
  search?: string | null;
  page?: number;
  limit?: number;
}

export interface VisitsResult {
  data: VisitWithDetails[];
  count: number;
  page: number;
  limit: number;
}

/**
 * Shared visits query — used by both /api/visits route and the server-rendered
 * /visites page. Keep this in sync with the API behavior.
 */
export async function fetchVisits(opts: VisitQueryOptions): Promise<VisitsResult> {
  const {
    all = false,
    currentUserId,
    userFilter,
    doctorId,
    from,
    to,
    type,
    wilaya,
    search,
    page = 1,
    limit = 50,
  } = opts;

  const offset = (page - 1) * limit;
  const supabase = await createClient();

  const needsInnerDoctor = !!wilaya || !!search;
  const doctorSelect = needsInnerDoctor
    ? "doctor:doctors!inner(*)"
    : "doctor:doctors(*)";

  let query = supabase
    .from("visits")
    .select(`*, ${doctorSelect}, user:users(*)`, { count: "exact" });

  if (!all) {
    if (currentUserId) {
      query = query.eq("user_id", userFilter || currentUserId);
    }
  } else if (userFilter) {
    query = query.eq("user_id", userFilter);
  }

  if (doctorId) query = query.eq("doctor_id", doctorId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (type === "medecin" || type === "pharmacien") {
    query = query.eq("visit_type", type);
  }
  if (wilaya) query = query.eq("doctor.wilaya", wilaya);
  if (search) {
    const like = `%${search}%`;
    query = query.or(`last_name.ilike.${like},first_name.ilike.${like}`, {
      foreignTable: "doctor",
    });
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  // Attach comment counts
  if (data && data.length > 0) {
    const visitIds = data.map((v) => v.id);
    const { data: comments } = await supabase
      .from("visit_comments")
      .select("visit_id")
      .in("visit_id", visitIds);

    const counts = new Map<string, number>();
    comments?.forEach((c) => {
      counts.set(c.visit_id, (counts.get(c.visit_id) || 0) + 1);
    });

    data.forEach((v) => {
      (v as Record<string, unknown>).comment_count = counts.get(v.id) || 0;
    });
  }

  return {
    data: (data || []) as VisitWithDetails[],
    count: count || 0,
    page,
    limit,
  };
}
