import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

// List the current supervisor's conversations (most recently used first).
export async function GET() {
  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (currentUser.role !== "superviseur") {
    return NextResponse.json({ error: "Réservé au superviseur" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", currentUser.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ conversations: data ?? [] });
}

// Create a new (empty) conversation owned by the current supervisor.
export async function POST(request: NextRequest) {
  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (currentUser.role !== "superviseur") {
    return NextResponse.json({ error: "Réservé au superviseur" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : undefined;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: currentUser.id, ...(title ? { title } : {}) })
    .select("id, title, created_at, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Création impossible" },
      { status: 500 }
    );
  }
  return NextResponse.json({ conversation: data }, { status: 201 });
}
