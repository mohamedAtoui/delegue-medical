import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (currentUser.role !== "superviseur") {
    return NextResponse.json(
      { error: "Réservé au superviseur" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("invited_users")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
