import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const user = await getOrCreateUser();
  if (!user || user.role !== "superviseur") {
    return NextResponse.json({ error: "Accès réservé aux superviseurs" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const to = searchParams.get("to") || new Date().toISOString();

  const supabase = await createClient();

  // Total visits in period
  const { count: totalVisits } = await supabase
    .from("visits")
    .select("*", { count: "exact", head: true })
    .gte("created_at", from)
    .lte("created_at", to);

  // Active reps (distinct users who logged visits)
  const { data: activeRepsData } = await supabase
    .from("visits")
    .select("user_id")
    .gte("created_at", from)
    .lte("created_at", to);

  const activeReps = new Set(activeRepsData?.map((v) => v.user_id)).size;

  // Total doctors visited
  const { data: doctorsVisitedData } = await supabase
    .from("visits")
    .select("doctor_id")
    .gte("created_at", from)
    .lte("created_at", to);

  const doctorsVisited = new Set(doctorsVisitedData?.map((v) => v.doctor_id)).size;

  // Visits per rep
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

  // Visits per wilaya
  const { data: visitsWithDoctors } = await supabase
    .from("visits")
    .select("doctor:doctors(wilaya)")
    .gte("created_at", from)
    .lte("created_at", to);

  const byWilaya: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visitsWithDoctors?.forEach((v: any) => {
    const wilaya = v.doctor?.wilaya;
    if (wilaya) {
      byWilaya[wilaya] = (byWilaya[wilaya] || 0) + 1;
    }
  });

  return NextResponse.json({
    totalVisits: totalVisits || 0,
    activeReps,
    doctorsVisited,
    byRep: Object.values(byRep).sort((a, b) => b.count - a.count),
    byWilaya: Object.entries(byWilaya)
      .map(([wilaya, count]) => ({ wilaya, count }))
      .sort((a, b) => b.count - a.count),
  });
}
