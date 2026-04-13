import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = await createClient();

  // Fetch existing assignment
  const { data: existing, error: fetchError } = await supabase
    .from("visit_assignments")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Assignation non trouvée" }, { status: 404 });
  }

  // Delegue can only edit own assignments
  if (currentUser.role === "delegue" && existing.assignee_id !== currentUser.id) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.deadline !== undefined) updates.deadline = body.deadline;
  if (body.note !== undefined) updates.note = body.note || null;
  if (body.doctor_id !== undefined) updates.doctor_id = body.doctor_id;
  if (body.status === "completed") {
    updates.status = "completed";
    updates.completed_at = new Date().toISOString();
    if (body.visit_id) updates.visit_id = body.visit_id;
  }

  const { data, error } = await supabase
    .from("visit_assignments")
    .update(updates)
    .eq("id", id)
    .select(
      `*, doctor:doctors(*), assignee:users!visit_assignments_assignee_id_fkey(id, first_name, last_name, avatar_url), assigner:users!visit_assignments_assigned_by_fkey(id, first_name, last_name, avatar_url)`
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  const { id } = await params;
  const supabase = await createClient();

  // Fetch to check ownership
  const { data: existing } = await supabase
    .from("visit_assignments")
    .select("assignee_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Assignation non trouvée" }, { status: 404 });
  }

  // Delegue can only delete own assignments
  if (currentUser.role === "delegue" && existing.assignee_id !== currentUser.id) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { error } = await supabase
    .from("visit_assignments")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
