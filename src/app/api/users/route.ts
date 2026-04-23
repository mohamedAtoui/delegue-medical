import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function fetchTodayCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (userIds.length === 0) return counts;
  const { data: visits } = await supabase
    .from("visits")
    .select("user_id")
    .in("user_id", userIds)
    .gte("created_at", startOfToday());
  visits?.forEach((v: { user_id: string }) => {
    counts.set(v.user_id, (counts.get(v.user_id) || 0) + 1);
  });
  return counts;
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const me = searchParams.get("me");
  const role = searchParams.get("role");
  const withTodayCount = searchParams.get("with_today_count") === "true";

  const supabase = await createClient();

  // Return current user only
  if (me === "true") {
    const { data: currentUser } = await supabase
      .from("users")
      .select("*")
      .eq("clerk_id", userId)
      .single();
    if (!currentUser) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }
    // Always include today_count for the current user
    const counts = await fetchTodayCounts(supabase, [currentUser.id]);
    return NextResponse.json({
      ...currentUser,
      today_count: counts.get(currentUser.id) || 0,
    });
  }

  let query = supabase.from("users").select("*").order("last_name");

  if (role) {
    query = query.eq("role", role);
  }

  const { data: users, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch territory assignments for all users
  const { data: territories } = await supabase
    .from("territory_assignments")
    .select("user_id, wilaya");

  const wilayaMap = new Map<string, string[]>();
  territories?.forEach((t) => {
    if (!wilayaMap.has(t.user_id)) {
      wilayaMap.set(t.user_id, []);
    }
    wilayaMap.get(t.user_id)!.push(t.wilaya);
  });

  // Optionally fetch today counts
  const todayCounts = withTodayCount
    ? await fetchTodayCounts(supabase, (users || []).map((u) => u.id))
    : null;

  const enriched = (users || []).map((u) => ({
    ...u,
    wilayas: wilayaMap.get(u.id) || [],
    ...(todayCounts ? { today_count: todayCounts.get(u.id) || 0 } : {}),
  }));

  return NextResponse.json(enriched);
}
