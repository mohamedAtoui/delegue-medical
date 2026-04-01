import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const { phone, wilayas } = body;

  if (!phone || !Array.isArray(wilayas) || wilayas.length === 0) {
    return NextResponse.json(
      { error: "Téléphone et wilayas sont requis" },
      { status: 400 }
    );
  }

  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  const supabase = await createClient();

  // Update phone
  await supabase
    .from("users")
    .update({ phone, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  // Set territory assignments
  await supabase
    .from("territory_assignments")
    .delete()
    .eq("user_id", user.id);

  await supabase.from("territory_assignments").insert(
    wilayas.map((wilaya: string) => ({
      user_id: user.id,
      wilaya,
      assigned_by: user.id,
    }))
  );

  return NextResponse.json({ success: true });
}
