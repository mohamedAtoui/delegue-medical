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
      type:
        type === "medecin" || type === "pharmacien" || type === "grossiste" || type === "focus"
          ? type
          : null,
      wilaya: searchParams.get("wilaya"),
      commune: searchParams.get("commune")?.trim() || null,
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

interface GrossistePayload {
  grossiste_id: string;
  category: "pharma" | "para_pharm";
}

interface TimingPayload {
  stage: "trajet" | "attente" | "visite";
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds: number;
  mode: "auto" | "manual";
}

/** Keep one valid timing per stage (last wins). */
function cleanTimings(input: unknown): TimingPayload[] {
  if (!Array.isArray(input)) return [];
  const byStage = new Map<string, TimingPayload>();
  for (const t of input) {
    if (
      t &&
      (t.stage === "trajet" || t.stage === "attente" || t.stage === "visite") &&
      typeof t.duration_seconds === "number" &&
      Number.isFinite(t.duration_seconds) &&
      t.duration_seconds >= 0 &&
      (t.mode === "auto" || t.mode === "manual")
    ) {
      byStage.set(t.stage, {
        stage: t.stage,
        started_at: typeof t.started_at === "string" ? t.started_at : null,
        ended_at: typeof t.ended_at === "string" ? t.ended_at : null,
        duration_seconds: Math.round(t.duration_seconds),
        mode: t.mode,
      });
    }
  }
  return [...byStage.values()];
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
    engagement,
    answers,
    grossistes,
    timings,
    focus_doctor_count,
    focus_lieu,
    focus_budget,
    focus_animateur,
    focus_audience_type,
    focus_contact_ids,
  } = body as {
    doctor_id?: string | null;
    product_id?: string;
    visit_type?: string;
    objective?: string;
    compte_rendu?: string;
    engagement?: number | null;
    answers?: AnswerPayload[];
    grossistes?: GrossistePayload[];
    timings?: TimingPayload[];
    focus_doctor_count?: number;
    focus_lieu?: string;
    focus_budget?: number;
    focus_animateur?: string;
    focus_audience_type?: string;
    focus_contact_ids?: string[];
  };

  if (visit_type !== "focus" && !doctor_id) {
    return NextResponse.json({ error: "Le contact est requis" }, { status: 400 });
  }
  if (
    visit_type !== "medecin" &&
    visit_type !== "pharmacien" &&
    visit_type !== "grossiste" &&
    visit_type !== "focus"
  ) {
    return NextResponse.json({ error: "Type de visite invalide" }, { status: 400 });
  }
  // Only médecin visits require a product; Focus is a contact-free event.
  if (visit_type === "medecin" && !product_id) {
    return NextResponse.json({ error: "Le produit est requis" }, { status: 400 });
  }
  if (visit_type === "medecin" &&
      (typeof objective !== "string" || !objective.trim() ||
       typeof compte_rendu !== "string" || !compte_rendu.trim())) {
    return NextResponse.json(
      { error: "Objectif et compte rendu requis pour un médecin" },
      { status: 400 }
    );
  }
  if (visit_type !== "medecin" &&
      (typeof compte_rendu !== "string" || !compte_rendu.trim())) {
    return NextResponse.json({ error: "Commentaire requis" }, { status: 400 });
  }
  if (visit_type === "focus") {
    if (focus_audience_type !== "medecin" && focus_audience_type !== "pharmacien" && focus_audience_type !== "grossiste") {
      return NextResponse.json({ error: "Choisissez le public du Focus" }, { status: 400 });
    }
    if (!Array.isArray(focus_contact_ids) || focus_contact_ids.length > 100 ||
      focus_contact_ids.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) ||
      new Set(focus_contact_ids).size !== focus_contact_ids.length) {
      return NextResponse.json({ error: "Liste de participants invalide" }, { status: 400 });
    }
    if (typeof focus_doctor_count === "number" && focus_contact_ids.length > focus_doctor_count) {
      return NextResponse.json({ error: "La liste dépasse le nombre de participants présents" }, { status: 400 });
    }
    if (
      !Number.isInteger(focus_doctor_count) ||
      (focus_doctor_count ?? 0) <= 0 ||
      typeof focus_lieu !== "string" ||
      !focus_lieu.trim() ||
      typeof focus_animateur !== "string" ||
      !focus_animateur.trim() ||
      typeof focus_budget !== "number" ||
      !Number.isFinite(focus_budget) ||
      focus_budget < 0 ||
      focus_budget > 9999999999.99
    ) {
      return NextResponse.json(
        { error: "Nombre de participants, lieu, budget et animateur requis pour un Focus" },
        { status: 400 }
      );
    }
  }
  // Engagement applies only to individual prescriber/pharmacy visits.
  let engagementValue: number | null = null;
  if ((visit_type === "medecin" || visit_type === "pharmacien") && engagement != null) {
    if (
      typeof engagement !== "number" ||
      !Number.isInteger(engagement) ||
      engagement < 1 ||
      engagement > 3
    ) {
      return NextResponse.json(
        { error: "L'engagement doit être un entier entre 1 et 3" },
        { status: 400 }
      );
    }
    engagementValue = engagement;
  }

  const supabase = await createClient();
  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  // The list is optional, but selected contacts must belong to this Focus audience.
  if (visit_type === "focus" && focus_contact_ids && focus_contact_ids.length > 0) {
    const { data: contacts, error: contactsError } = await supabase
      .from("doctors").select("id, doctor_type").in("id", focus_contact_ids);
    if (contactsError || !contacts || contacts.length !== focus_contact_ids.length ||
      contacts.some((contact) => contact.doctor_type !== focus_audience_type)) {
      return NextResponse.json({ error: "Certains participants ne correspondent pas au public choisi" }, { status: 400 });
    }
  }

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .insert({
      user_id: currentUser.id,
      doctor_id: visit_type === "focus" ? null : doctor_id,
      product_id: visit_type === "medecin" ? product_id : null,
      visit_type,
      objective: visit_type === "medecin" ? objective?.trim() || null : null,
      compte_rendu: compte_rendu?.trim() || null,
      engagement: engagementValue,
      focus_doctor_count: visit_type === "focus" ? focus_doctor_count : null,
      focus_lieu: visit_type === "focus" ? focus_lieu?.trim() : null,
      focus_budget: visit_type === "focus" ? focus_budget : null,
      focus_animateur: visit_type === "focus" ? focus_animateur?.trim() : null,
      focus_audience_type: visit_type === "focus" ? focus_audience_type : null,
      // Legacy answer columns stay NULL for new visits — answers live in
      // visit_answers.
    })
    .select("*, doctor:doctors!visits_doctor_id_fkey(*), user:users(*)")
    .single();

  if (visitError || !visit) {
    return NextResponse.json(
      { error: visitError?.message ?? "Erreur lors de la création de la visite" },
      { status: 500 }
    );
  }

  if (visit_type === "focus" && focus_contact_ids && focus_contact_ids.length > 0) {
    const { error: contactsError } = await supabase.from("focus_visit_contacts").insert(
      focus_contact_ids.map((id) => ({ visit_id: visit.id, doctor_id: id }))
    );
    if (contactsError) {
      await supabase.from("visits").delete().eq("id", visit.id);
      return NextResponse.json({ error: `Impossible de lier les participants : ${contactsError.message}` }, { status: 500 });
    }
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

  // Persist grossistes recorded at this pharmacy visit and keep the pharmacy's
  // current grossiste list (doctor_grossistes) in sync. If either write fails,
  // do not tell the user the visit was saved without its selected grossistes.
  if (
    visit_type === "pharmacien" &&
    Array.isArray(grossistes) &&
    grossistes.length > 0
  ) {
    const clean = grossistes.filter(
      (g) =>
        g &&
        typeof g.grossiste_id === "string" &&
        (g.category === "pharma" || g.category === "para_pharm")
    );
    if (clean.length > 0) {
      const { error: visitGrossistesError } = await supabase.from("visit_grossistes").insert(
        clean.map((g) => ({
          visit_id: visit.id,
          grossiste_id: g.grossiste_id,
          category: g.category,
        }))
      );
      if (visitGrossistesError) {
        await supabase.from("visits").delete().eq("id", visit.id);
        return NextResponse.json(
          { error: `Impossible d'enregistrer les grossistes de la visite : ${visitGrossistesError.message}` },
          { status: 500 }
        );
      }
      const { error: doctorGrossistesError } = await supabase.from("doctor_grossistes").upsert(
        clean.map((g) => ({
          doctor_id,
          grossiste_id: g.grossiste_id,
          category: g.category,
        })),
        { onConflict: "doctor_id,grossiste_id,category" }
      );
      if (doctorGrossistesError) {
        await supabase.from("visits").delete().eq("id", visit.id);
        return NextResponse.json(
          { error: `Impossible de lier les grossistes à la pharmacie : ${doctorGrossistesError.message}` },
          { status: 500 }
        );
      }
    }
  }

  // Persist stage timings (médecin visits). Immutable afterwards for the
  // délégué — there is no délégué endpoint to change them. Best-effort.
  if (visit_type === "medecin") {
    const cleanTimingRows = cleanTimings(timings);
    if (cleanTimingRows.length > 0) {
      await supabase.from("visit_timings").insert(
        cleanTimingRows.map((t) => ({
          visit_id: visit.id,
          stage: t.stage,
          started_at: t.started_at,
          ended_at: t.ended_at,
          duration_seconds: t.duration_seconds,
          mode: t.mode,
        }))
      );
    }
  }

  // Auto-complete pending assignments for this doctor
  if (doctor_id && visit_type !== "focus") {
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
  }

  return NextResponse.json(visit, { status: 201 });
}
