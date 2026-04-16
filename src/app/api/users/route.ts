import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const me = searchParams.get("me");
  const role = searchParams.get("role");

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
    return NextResponse.json(currentUser);
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

  const enriched = (users || []).map((u) => ({
    ...u,
    wilayas: wilayaMap.get(u.id) || [],
  }));

  return NextResponse.json(enriched);
}
