import { createClient } from "@/utils/supabase/server";

export interface DashboardStats {
  totalVisits: number;
  activeReps: number;
  doctorsVisited: number;
  byRep: Array<{ name: string; count: number }>;
  byWilaya: Array<{ wilaya: string; count: number }>;
}

export interface StatsRange {
  from: string;
  to: string;
}

export function getDateRangeForPeriod(
  period: "today" | "week" | "month"
): StatsRange {
  const now = new Date();
  const from = new Date();
  if (period === "today") from.setHours(0, 0, 0, 0);
  else if (period === "week") from.setDate(now.getDate() - 7);
  else from.setMonth(now.getMonth() - 1);
  return { from: from.toISOString(), to: now.toISOString() };
}

/** Shared dashboard stats query — used by /api/stats and the server-rendered
 *  dashboard page. */
export async function fetchDashboardStats(
  range: StatsRange
): Promise<DashboardStats> {
  const { from, to } = range;
  const supabase = await createClient();

  const { count: totalVisits } = await supabase
    .from("visits")
    .select("*", { count: "exact", head: true })
    .gte("created_at", from)
    .lte("created_at", to);

  const { data: activeRepsData } = await supabase
    .from("visits")
    .select("user_id")
    .gte("created_at", from)
    .lte("created_at", to);
  const activeReps = new Set(activeRepsData?.map((v) => v.user_id)).size;

  const { data: doctorsVisitedData } = await supabase
    .from("visits")
    .select("doctor_id")
    .gte("created_at", from)
    .lte("created_at", to);
  const doctorsVisited = new Set(doctorsVisitedData?.map((v) => v.doctor_id))
    .size;

  const { data: visits } = await supabase
    .from("visits")
    .select("user_id, user:users(first_name, last_name)")
    .gte("created_at", from)
    .lte("created_at", to);

  const byRep: Record<string, { name: string; count: number }> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visits?.forEach((v: any) => {
    if (!byRep[v.user_id]) {
      byRep[v.user_id] = {
        name: `${v.user?.first_name || ""} ${v.user?.last_name || ""}`.trim(),
        count: 0,
      };
    }
    byRep[v.user_id].count++;
  });

  const { data: visitsWithDoctors } = await supabase
    .from("visits")
    .select("doctor:doctors!visits_doctor_id_fkey(wilaya)")
    .gte("created_at", from)
    .lte("created_at", to);

  const byWilaya: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visitsWithDoctors?.forEach((v: any) => {
    const wilaya = v.doctor?.wilaya;
    if (wilaya) byWilaya[wilaya] = (byWilaya[wilaya] || 0) + 1;
  });

  return {
    totalVisits: totalVisits || 0,
    activeReps,
    doctorsVisited,
    byRep: Object.values(byRep).sort((a, b) => b.count - a.count),
    byWilaya: Object.entries(byWilaya)
      .map(([wilaya, count]) => ({ wilaya, count }))
      .sort((a, b) => b.count - a.count),
  };
}
