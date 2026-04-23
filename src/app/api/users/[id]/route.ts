import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (currentUser.role !== "superviseur") {
    return NextResponse.json(
      { error: "Seul un superviseur peut modifier un délégué" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = {};

  if (typeof body.daily_visit_goal === "number") {
    if (body.daily_visit_goal < 0 || body.daily_visit_goal > 100) {
      return NextResponse.json(
        { error: "L'objectif doit être entre 0 et 100" },
        { status: 400 }
      );
    }
    update.daily_visit_goal = body.daily_visit_goal;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
