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

interface AnswerPayload {
  question_id: string;
  value_boolean?: boolean | null;
  value_text?: string | null;
  value_number?: number | null;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const {
    doctor_id,
    product_id,
    visit_type,
    objective,
    compte_rendu,
    answers,
  } = body as {
    doctor_id?: string;
    product_id?: string;
    visit_type?: string;
    objective?: string;
    compte_rendu?: string;
    answers?: AnswerPayload[];
  };

  if (!doctor_id) {
    return NextResponse.json({ error: "Le médecin/pharmacien est requis" }, { status: 400 });
  }
  if (visit_type !== "medecin" && visit_type !== "pharmacien") {
    return NextResponse.json({ error: "Type de visite invalide" }, { status: 400 });
  }
  if (!product_id) {
    return NextResponse.json({ error: "Le produit est requis" }, { status: 400 });
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

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .insert({
      user_id: currentUser.id,
      doctor_id,
      product_id,
      visit_type,
      objective: objective || null,
      compte_rendu: compte_rendu || null,
      // Legacy answer columns stay NULL for new visits — answers live in
      // visit_answers.
    })
    .select("*, doctor:doctors(*), user:users(*)")
    .single();

  if (visitError || !visit) {
    return NextResponse.json(
      { error: visitError?.message ?? "Erreur lors de la création de la visite" },
      { status: 500 }
    );
  }

  // Persist answers. If this fails, remove the visit we just inserted so
  // the caller isn't left with an empty half-written row.
  if (Array.isArray(answers) && answers.length > 0) {
    const rows = answers
      .filter(
        (a) =>
          a &&
          typeof a.question_id === "string" &&
          (a.value_boolean !== undefined ||
            a.value_text !== undefined ||
            a.value_number !== undefined)
      )
      .map((a) => ({
        visit_id: visit.id,
        question_id: a.question_id,
        value_boolean: a.value_boolean ?? null,
        value_text: a.value_text ?? null,
        value_number: a.value_number ?? null,
      }));

    if (rows.length > 0) {
      const { error: answersError } = await supabase
        .from("visit_answers")
        .insert(rows);
      if (answersError) {
        await supabase.from("visits").delete().eq("id", visit.id);
        return NextResponse.json(
          { error: answersError.message },
          { status: 500 }
        );
      }
    }
  }

  // Auto-complete pending assignments for this doctor
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
        visit_id: visit.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingAssignments[0].id);
  }

  return NextResponse.json(visit, { status: 201 });
}
