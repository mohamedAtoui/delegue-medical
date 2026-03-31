import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userIdFilter = searchParams.get("user_id");

  const supabase = await createClient();
  let query = supabase.from("territory_assignments").select("*");

  if (userIdFilter) {
    query = query.eq("user_id", userIdFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const user = await getOrCreateUser();
  if (!user || user.role !== "superviseur") {
    return NextResponse.json({ error: "Accès réservé aux superviseurs" }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, wilayas } = body;

  if (!user_id || !Array.isArray(wilayas)) {
    return NextResponse.json(
      { error: "user_id et wilayas sont requis" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Get current user for assigned_by
  const { data: currentUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  // Delete existing assignments
  await supabase
    .from("territory_assignments")
    .delete()
    .eq("user_id", user_id);

  // Insert new ones
  if (wilayas.length > 0) {
    const { error } = await supabase.from("territory_assignments").insert(
      wilayas.map((wilaya: string) => ({
        user_id,
        wilaya,
        assigned_by: currentUser?.id || null,
      }))
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
