import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { fetchVisits } from "@/lib/queries/visits";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "true";
  const userFilter = searchParams.get("user_id");
  const type = searchParams.get("type");

  let currentUserId: string | undefined;
  if (!all) {
    const currentUser = await getOrCreateUser();
    currentUserId = currentUser?.id;
  }

  try {
    const result = await fetchVisits({
      all,
      currentUserId,
      userFilter,
      doctorId: searchParams.get("doctor_id"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      type: type === "medecin" || type === "pharmacien" ? type : null,
      wilaya: searchParams.get("wilaya"),
      search: searchParams.get("search")?.trim() || null,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
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

  const body = await request.json();
  const {
    doctor_id,
    visit_type,
    objective,
    compte_rendu,
    // médecin checklist
    synapgen_solves,
    already_prescribed,
    promised_to_suggest,
    price_objection,
    prescribes_magnesium,
    magnesium_brand,
    fears_side_effects,
    patient_feedback,
    patient_feedback_comment,
    ordonnance_return,
    free_sample,
    // pharmacien
    synapgen_count,
    prescriptions_received,
    prescribing_doctor,
    accepted_order,
  } = body;

  if (!doctor_id) {
    return NextResponse.json({ error: "Le médecin/pharmacien est requis" }, { status: 400 });
  }
  if (visit_type !== "medecin" && visit_type !== "pharmacien") {
    return NextResponse.json({ error: "Type de visite invalide" }, { status: 400 });
  }
  if (visit_type === "medecin" && (!objective || !compte_rendu)) {
    return NextResponse.json(
      { error: "Objectif et compte rendu requis pour un médecin" },
      { status: 400 }
    );
  }
  if (visit_type === "pharmacien" && !compte_rendu) {
    return NextResponse.json({ error: "Commentaire requis" }, { status: 400 });
  }

  const supabase = await createClient();
  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("visits")
    .insert({
      user_id: currentUser.id,
      doctor_id,
      visit_type,
      objective: objective || null,
      compte_rendu: compte_rendu || null,
      synapgen_solves: visit_type === "medecin" ? synapgen_solves ?? null : null,
      already_prescribed: visit_type === "medecin" ? already_prescribed ?? null : null,
      promised_to_suggest: visit_type === "medecin" ? promised_to_suggest ?? null : null,
      price_objection: visit_type === "medecin" ? price_objection ?? null : null,
      prescribes_magnesium: visit_type === "medecin" ? prescribes_magnesium ?? null : null,
      magnesium_brand: visit_type === "medecin" ? magnesium_brand || null : null,
      fears_side_effects: visit_type === "medecin" ? fears_side_effects ?? null : null,
      patient_feedback: visit_type === "medecin" ? patient_feedback ?? null : null,
      patient_feedback_comment:
        visit_type === "medecin" ? patient_feedback_comment || null : null,
      ordonnance_return: visit_type === "medecin" ? ordonnance_return ?? null : null,
      free_sample: visit_type === "medecin" ? free_sample ?? null : null,
      synapgen_count: visit_type === "pharmacien" ? synapgen_count ?? null : null,
      prescriptions_received:
        visit_type === "pharmacien" ? prescriptions_received ?? null : null,
      prescribing_doctor: visit_type === "pharmacien" ? prescribing_doctor || null : null,
      accepted_order: visit_type === "pharmacien" ? accepted_order ?? null : null,
    })
    .select("*, doctor:doctors(*), user:users(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-complete pending assignments for this doctor
  if (data) {
    const { data: pendingAssignments } = await supabase
      .from("visit_assignments")
      .select("id")
      .eq("assignee_id", currentUser.id)
      .eq("doctor_id", doctor_id)
      .eq("status", "pending")
      .order("deadline", { ascending: true })
      .limit(1);

    if (pendingAssignments && pendingAssignments.length > 0) {
      await supabase
        .from("visit_assignments")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          visit_id: data.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pendingAssignments[0].id);
    }
  }

  return NextResponse.json(data, { status: 201 });
}
