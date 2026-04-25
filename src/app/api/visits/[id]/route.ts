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
      { error: "Seul un superviseur peut supprimer une visite" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const supabase = await createClient();

  // Step 1: unlink any visit_assignments that were auto-completed by this
  // visit, and revert them to "pending" so the delegue knows to re-log.
  // (visit_assignments.visit_id has no ON DELETE behavior set, so we do it
  // explicitly here to avoid FK violations.)
  const { error: unlinkError } = await supabase
    .from("visit_assignments")
    .update({
      visit_id: null,
      status: "pending",
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("visit_id", id);

  if (unlinkError) {
    return NextResponse.json(
      { error: `Échec du déliage des planifications : ${unlinkError.message}` },
      { status: 500 }
    );
  }

  // Step 2: delete the visit. visit_comments cascade automatically.
  const { error } = await supabase.from("visits").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
