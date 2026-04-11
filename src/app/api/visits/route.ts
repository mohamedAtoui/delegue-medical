import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userFilter = searchParams.get("user_id");
  const doctorId = searchParams.get("doctor_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const type = searchParams.get("type"); // medecin | pharmacien
  const wilaya = searchParams.get("wilaya");
  const search = searchParams.get("search")?.trim();
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const all = searchParams.get("all") === "true";
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  // Use inner join on doctors when filtering by wilaya or doctor name
  const needsInnerDoctor = !!wilaya || !!search;
  const doctorSelect = needsInnerDoctor ? "doctor:doctors!inner(*)" : "doctor:doctors(*)";

  let query = supabase
    .from("visits")
    .select(`*, ${doctorSelect}, user:users(*)`, { count: "exact" });

  if (!all) {
    const currentUser = await getOrCreateUser();
    if (currentUser) {
      query = query.eq("user_id", userFilter || currentUser.id);
    }
  } else if (userFilter) {
    query = query.eq("user_id", userFilter);
  }

  if (doctorId) query = query.eq("doctor_id", doctorId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (type === "medecin" || type === "pharmacien") {
    query = query.eq("visit_type", type);
  }
  if (wilaya) {
    query = query.eq("doctor.wilaya", wilaya);
  }
  if (search) {
    // Search on doctor last/first name (via inner join)
    const like = `%${search}%`;
    query = query.or(`last_name.ilike.${like},first_name.ilike.${like}`, {
      foreignTable: "doctor",
    });
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attach comment count to each visit
  if (data && data.length > 0) {
    const visitIds = data.map((v) => v.id);
    const { data: comments } = await supabase
      .from("visit_comments")
      .select("visit_id")
      .in("visit_id", visitIds);

    const counts = new Map<string, number>();
    comments?.forEach((c) => {
      counts.set(c.visit_id, (counts.get(c.visit_id) || 0) + 1);
    });

    data.forEach((v) => {
      (v as Record<string, unknown>).comment_count = counts.get(v.id) || 0;
    });
  }

  return NextResponse.json({ data, count, page, limit });
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

  return NextResponse.json(data, { status: 201 });
}
