import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { fetchAssignments } from "@/lib/queries/assignments";
import { createNotifications } from "@/lib/notifications/create";

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
  const status = searchParams.get("status");

  try {
    const result = await fetchAssignments({
      currentUserId: currentUser.id,
      currentUserRole: currentUser.role,
      assigneeId: searchParams.get("assignee_id"),
      status:
        status === "completed" || status === "pending" || status === "overdue"
          ? status
          : null,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "50"),
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
  const { doctor_id, deadline, note } = body;
  // Allow "self" or missing assignee_id for delegue self-assignment
  const assignee_id = body.assignee_id === "self" || !body.assignee_id
    ? currentUser.id
    : body.assignee_id;

  if (!doctor_id || !deadline) {
    return NextResponse.json(
      { error: "Médecin/pharmacien et date limite sont requis" },
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

  // Notify the assignee (skip if self-assigned)
  if (data && assignee_id !== currentUser.id) {
    try {
      const isPharm = data.doctor?.doctor_type === "pharmacien";
      const docName = `${isPharm ? "" : "Dr. "}${data.doctor?.last_name || ""} ${data.doctor?.first_name || ""}`.trim();
      const supName = `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim() || "Le superviseur";
      const deadlineDate = new Date(deadline);
      const dateText = deadlineDate.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
      });
      await createNotifications(supabase, [
        {
          user_id: assignee_id,
          type: "assignment_new",
          title: `${supName} vous a assigné une visite : ${docName}`,
          message: `Échéance : ${dateText}`,
          link: `/planification?assignment=${data.id}`,
          entity_id: data.id,
          entity_type: "assignment",
        },
      ]);
    } catch (e) {
      console.error("Notification creation failed:", e);
    }
  }

  return NextResponse.json(data, { status: 201 });
}
