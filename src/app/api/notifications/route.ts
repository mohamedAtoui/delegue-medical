import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { createNotificationIfMissing } from "@/lib/notifications/create";

export async function GET() {
  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = await createClient();

  // Lazy: create "due_soon" and "overdue" notifications for the current user's
  // pending assignments. Dedup by (user_id, type, entity_id).
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: dueSoon } = await supabase
    .from("visit_assignments")
    .select("id, deadline, doctor_id, doctor:doctors(first_name, last_name, doctor_type)")
    .eq("assignee_id", currentUser.id)
    .eq("status", "pending")
    .gte("deadline", now.toISOString())
    .lte("deadline", in24h.toISOString());

  for (const a of (dueSoon || []) as Array<{
    id: string;
    deadline: string;
    doctor_id: string;
    doctor?: { first_name?: string; last_name?: string; doctor_type?: string } | null;
  }>) {
    const isPharm = a.doctor?.doctor_type === "pharmacien";
    const name = `${isPharm ? "" : "Dr. "}${a.doctor?.last_name || ""} ${a.doctor?.first_name || ""}`.trim();
    await createNotificationIfMissing(supabase, {
      user_id: currentUser.id,
      type: "assignment_due_soon",
      title: `Visite à faire bientôt : ${name}`,
      message: "Échéance dans moins de 24 heures",
      link: `/planification?assignment=${a.id}`,
      entity_id: a.id,
      entity_type: "assignment",
    });
  }

  const { data: overdue } = await supabase
    .from("visit_assignments")
    .select("id, deadline, doctor_id, doctor:doctors(first_name, last_name, doctor_type)")
    .eq("assignee_id", currentUser.id)
    .eq("status", "pending")
    .lt("deadline", now.toISOString());

  for (const a of (overdue || []) as Array<{
    id: string;
    deadline: string;
    doctor_id: string;
    doctor?: { first_name?: string; last_name?: string; doctor_type?: string } | null;
  }>) {
    const isPharm = a.doctor?.doctor_type === "pharmacien";
    const name = `${isPharm ? "" : "Dr. "}${a.doctor?.last_name || ""} ${a.doctor?.first_name || ""}`.trim();
    await createNotificationIfMissing(supabase, {
      user_id: currentUser.id,
      type: "assignment_overdue",
      title: `Visite en retard : ${name}`,
      message: "L'échéance est passée",
      link: `/planification?assignment=${a.id}`,
      entity_id: a.id,
      entity_type: "assignment",
    });
  }

  // Return user's notifications, newest first
  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const unreadCount = (notifications || []).filter((n) => !n.read).length;

  return NextResponse.json({ data: notifications || [], unread_count: unreadCount });
}
