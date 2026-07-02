import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import * as XLSX from "xlsx";

function yn(v: boolean | null | undefined): string {
  if (v === true) return "Oui";
  if (v === false) return "Non";
  return "";
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const user = await getOrCreateUser();
  if (!user || user.role !== "superviseur") {
    return NextResponse.json(
      { error: "Accès réservé aux superviseurs" },
      { status: 403 }
    );
  }

  const supabase = await createClient();

  const [doctorsRes, visitsRes, usersRes, territoriesRes, commentsRes] =
    await Promise.all([
      supabase.from("doctors").select("*").order("last_name"),
      supabase
        .from("visits")
        .select(
          "*, doctor:doctors!visits_doctor_id_fkey(first_name, last_name, wilaya, doctor_type), user:users(first_name, last_name, email)"
        )
        .order("created_at", { ascending: false }),
      supabase.from("users").select("*").order("last_name"),
      supabase
        .from("territory_assignments")
        .select("user_id, wilaya"),
      supabase
        .from("visit_comments")
        .select(
          "*, user:users(first_name, last_name), visit:visits(created_at, doctor:doctors!visits_doctor_id_fkey(first_name, last_name))"
        )
        .order("created_at", { ascending: false }),
    ]);

  const wb = XLSX.utils.book_new();

  // Build wilaya map for users
  const wilayaMap = new Map<string, string[]>();
  territoriesRes.data?.forEach((t) => {
    if (!wilayaMap.has(t.user_id)) wilayaMap.set(t.user_id, []);
    wilayaMap.get(t.user_id)!.push(t.wilaya);
  });

  // Sheet 1: Médecins / Pharmaciens
  const doctorsData = (doctorsRes.data || []).map((d) => ({
    Nom: d.last_name,
    Prénom: d.first_name,
    Type: d.doctor_type === "pharmacien" ? "Pharmacien" : "Médecin",
    Spécialité: d.specialty || "",
    Wilaya: d.wilaya,
    Adresse: d.address || "",
    "Google Maps": d.google_maps_url || "",
    "Tél. fixe": d.phone_fixe || "",
    "Tél. portable": d.phone_mobile || d.phone || "",
    Email: d.email || "",
    Potentiel: d.potentiel || "",
    Engagement: d.engagement || 0,
    "Grossiste Pharma": d.grossiste_pharma || "",
    "Grossiste Para-Pharm": d.grossiste_para_pharm || "",
    "Créé le": d.created_at
      ? new Date(d.created_at).toLocaleDateString("fr-FR")
      : "",
  }));
  const wsMedecins = XLSX.utils.json_to_sheet(doctorsData);
  XLSX.utils.book_append_sheet(wb, wsMedecins, "Médecins & Pharmaciens");

  // Sheet 2: Visites (structured)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visitsData = (visitsRes.data || []).map((v: any) => {
    const isPharm = v.visit_type === "pharmacien";
    const d = v.doctor || {};
    const u = v.user || {};
    return {
      Date: v.created_at
        ? new Date(v.created_at).toLocaleDateString("fr-FR")
        : "",
      Heure: v.created_at
        ? new Date(v.created_at).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
      Délégué: `${u.first_name || ""} ${u.last_name || ""}`.trim(),
      Type: isPharm ? "Pharmacien" : "Médecin",
      Cible: `${isPharm ? "" : "Dr. "}${d.last_name || ""} ${d.first_name || ""}`.trim(),
      Wilaya: d.wilaya || "",
      Objectif: v.objective || "",
      "Compte rendu / Commentaire": v.compte_rendu || "",
      "Synapgen résout les besoins": yn(v.synapgen_solves),
      "Déjà prescrit": yn(v.already_prescribed),
      "Promis de suggérer": yn(v.promised_to_suggest),
      "Objection prix": yn(v.price_objection),
      "Prescrit magnésium": yn(v.prescribes_magnesium),
      "Marque magnésium": v.magnesium_brand || "",
      "Crainte effets secondaires": yn(v.fears_side_effects),
      "Retour patients": yn(v.patient_feedback),
      "Commentaire patients": v.patient_feedback_comment || "",
      "Retour d'ordonnance": yn(v.ordonnance_return),
      "Échantillon donné": yn(v.free_sample),
      "Nb Synapgen en stock":
        v.synapgen_count != null ? v.synapgen_count : "",
      "Nb prescriptions reçues":
        v.prescriptions_received != null ? v.prescriptions_received : "",
      Prescripteur: v.prescribing_doctor || "",
      "A accepté commande": yn(v.accepted_order),
    };
  });
  const wsVisites = XLSX.utils.json_to_sheet(visitsData);
  XLSX.utils.book_append_sheet(wb, wsVisites, "Visites");

  // Sheet 3: Commentaires
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commentsData = (commentsRes.data || []).map((c: any) => {
    const v = c.visit || {};
    const d = v.doctor || {};
    const u = c.user || {};
    return {
      Date: c.created_at
        ? new Date(c.created_at).toLocaleDateString("fr-FR")
        : "",
      Heure: c.created_at
        ? new Date(c.created_at).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
      "Visite (date)": v.created_at
        ? new Date(v.created_at).toLocaleDateString("fr-FR")
        : "",
      Médecin: `${d.last_name || ""} ${d.first_name || ""}`.trim(),
      Auteur: `${u.first_name || ""} ${u.last_name || ""}`.trim(),
      Commentaire: c.content || "",
    };
  });
  const wsComments = XLSX.utils.json_to_sheet(commentsData);
  XLSX.utils.book_append_sheet(wb, wsComments, "Commentaires");

  // Sheet 4: Délégués
  const usersData = (usersRes.data || []).map((u) => ({
    Nom: u.last_name || "",
    Prénom: u.first_name || "",
    Email: u.email,
    Téléphone: u.phone || "",
    Wilayas: (wilayaMap.get(u.id) || []).join(", "),
    Rôle: u.role === "superviseur" ? "Superviseur" : "Délégué",
    "Créé le": u.created_at
      ? new Date(u.created_at).toLocaleDateString("fr-FR")
      : "",
  }));
  const wsUsers = XLSX.utils.json_to_sheet(usersData);
  XLSX.utils.book_append_sheet(wb, wsUsers, "Délégués");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

  const date = new Date().toISOString().split("T")[0];
  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="handson-export-${date}.xlsx"`,
    },
  });
}
