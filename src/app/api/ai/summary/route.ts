import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { askAboutVisits } from "@/lib/mistral";

function yn(v: boolean | null | undefined): string {
  if (v === true) return "Oui";
  if (v === false) return "Non";
  return "—";
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const { wilaya, user_id, from, to, type, prompt } = body;

  const supabase = await createClient();

  let query = supabase
    .from("visits")
    .select(
      "*, doctor:doctors(first_name, last_name, wilaya, specialty, doctor_type), user:users(first_name, last_name)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (user_id && user_id !== "all") query = query.eq("user_id", user_id);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (type === "medecin" || type === "pharmacien") query = query.eq("visit_type", type);

  const { data: visits, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filteredVisits = (visits || []) as any[];
  if (wilaya) {
    filteredVisits = filteredVisits.filter((v) => v.doctor?.wilaya === wilaya);
  }

  if (filteredVisits.length === 0) {
    return NextResponse.json({
      summary: "Aucune visite trouvée pour les critères sélectionnés.",
    });
  }

  // Build rich context with structured data
  const context = filteredVisits
    .map((v, i) => {
      const isPharm = v.visit_type === "pharmacien";
      const doc = `${isPharm ? "" : "Dr. "}${v.doctor?.last_name || ""} ${v.doctor?.first_name || ""}`.trim();
      const rep = `${v.user?.first_name || ""} ${v.user?.last_name || ""}`.trim();
      const spec = v.doctor?.specialty || "";
      const wil = v.doctor?.wilaya || "";

      if (isPharm) {
        return [
          `${i + 1}. [Pharmacien] [${doc}, ${wil}] [Délégué: ${rep}]`,
          v.compte_rendu ? `   Commentaire: ${v.compte_rendu}` : "",
          v.synapgen_count != null ? `   Stock Synapgen: ${v.synapgen_count}` : "",
          v.prescriptions_received != null
            ? `   Prescriptions reçues: ${v.prescriptions_received}`
            : "",
          v.prescribing_doctor ? `   Prescripteur: ${v.prescribing_doctor}` : "",
          v.accepted_order !== null ? `   Commande acceptée: ${yn(v.accepted_order)}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      }

      return [
        `${i + 1}. [Médecin] [${doc}${spec ? `, ${spec}` : ""}, ${wil}] [Délégué: ${rep}]`,
        v.objective ? `   Objectif: ${v.objective}` : "",
        v.compte_rendu ? `   Compte rendu: ${v.compte_rendu}` : "",
        `   Synapgen résout les besoins: ${yn(v.synapgen_solves)}`,
        `   Déjà prescrit: ${yn(v.already_prescribed)}`,
        `   Promis de suggérer: ${yn(v.promised_to_suggest)}`,
        `   Objection prix: ${yn(v.price_objection)}`,
        `   Prescrit du magnésium: ${yn(v.prescribes_magnesium)}${v.magnesium_brand ? ` (marque: ${v.magnesium_brand})` : ""}`,
        `   Crainte effets secondaires: ${yn(v.fears_side_effects)}`,
        `   Retour patients: ${yn(v.patient_feedback)}${v.patient_feedback_comment ? ` (${v.patient_feedback_comment})` : ""}`,
        `   Retour ordonnance: ${yn(v.ordonnance_return)}`,
        `   Échantillon donné: ${yn(v.free_sample)}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  try {
    const summary = await askAboutVisits(
      context,
      prompt || "Résume les points clés de ces visites."
    );
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur IA" },
      { status: 500 }
    );
  }
}
