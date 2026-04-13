import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const assigneeId = searchParams.get("assignee_id");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  let query = supabase
    .from("visit_assignments")
    .select(
      `*, doctor:doctors(*), assignee:users!visit_assignments_assignee_id_fkey(id, first_name, last_name, avatar_url), assigner:users!visit_assignments_assigned_by_fkey(id, first_name, last_name, avatar_url)`,
      { count: "exact" }
    );

  // Delegue can only see own assignments
  if (currentUser.role === "delegue") {
    query = query.eq("assignee_id", currentUser.id);
  } else if (assigneeId) {
    query = query.eq("assignee_id", assigneeId);
  }

  // Filter by status (overdue is computed client-side from pending + past deadline)
  if (status === "completed") {
    query = query.eq("status", "completed");
  } else if (status === "pending" || status === "overdue") {
    query = query.eq("status", "pending");
  }

  const { data, error, count } = await query
    .order("deadline", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Compute overdue status for pending items
  const now = new Date();
  const enriched = (data || []).map((item) => ({
    ...item,
    status:
      item.status === "pending" && new Date(item.deadline) < now
        ? "overdue"
        : item.status,
  }));

  // If filtering by overdue/pending specifically, filter after computation
  let filtered = enriched;
  if (status === "overdue") {
    filtered = enriched.filter((item) => item.status === "overdue");
  } else if (status === "pending") {
    filtered = enriched.filter((item) => item.status === "pending");
  }

  return NextResponse.json({ data: filtered, count, page, limit });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  const body = await request.json();
  const { assignee_id, doctor_id, deadline, note } = body;

  if (!assignee_id || !doctor_id || !deadline) {
    return NextResponse.json(
      { error: "Délégué, médecin/pharmacien et date limite sont requis" },
      { status: 400 }
    );
  }

  // Delegue can only assign to self
  if (currentUser.role === "delegue" && assignee_id !== currentUser.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez assigner des visites qu'à vous-même" },
      { status: 403 }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("visit_assignments")
    .insert({
      assignee_id,
      doctor_id,
      assigned_by: currentUser.id,
      deadline,
      note: note || null,
      status: "pending",
    })
    .select(
      `*, doctor:doctors(*), assignee:users!visit_assignments_assignee_id_fkey(id, first_name, last_name, avatar_url), assigner:users!visit_assignments_assigned_by_fkey(id, first_name, last_name, avatar_url)`
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
