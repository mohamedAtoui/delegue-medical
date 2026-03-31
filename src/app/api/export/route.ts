import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import * as XLSX from "xlsx";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const user = await getOrCreateUser();
  if (!user || user.role !== "superviseur") {
    return NextResponse.json({ error: "Accès réservé aux superviseurs" }, { status: 403 });
  }

  const supabase = await createClient();

  // Fetch all data
  const [doctorsRes, visitsRes, usersRes, territoriesRes] = await Promise.all([
    supabase.from("doctors").select("*").order("last_name"),
    supabase.from("visits").select("*, doctor:doctors(first_name, last_name, wilaya), product:products(name), user:users(first_name, last_name, email)").order("created_at", { ascending: false }),
    supabase.from("users").select("*").order("last_name"),
    supabase.from("territory_assignments").select("*, user:users(first_name, last_name)").order("wilaya"),
  ]);

  const wb = XLSX.utils.book_new();

  // Sheet 1: Médecins
  const doctorsData = (doctorsRes.data || []).map((d) => ({
    Nom: d.last_name,
    Prénom: d.first_name,
    Type: d.doctor_type === "pharmacien" ? "Pharmacien" : "Médecin",
    Spécialité: d.specialty || "",
    Wilaya: d.wilaya,
    Adresse: d.address || "",
    Téléphone: d.phone || "",
    Potentiel: d.potentiel || "",
    Engagement: d.engagement || 0,
    "Créé le": d.created_at ? new Date(d.created_at).toLocaleDateString("fr-FR") : "",
  }));
  const wsMedecins = XLSX.utils.json_to_sheet(doctorsData);
  XLSX.utils.book_append_sheet(wb, wsMedecins, "Médecins");

  // Sheet 2: Visites
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visitsData = (visitsRes.data || []).map((v: any) => ({
    Date: v.created_at ? new Date(v.created_at).toLocaleDateString("fr-FR") : "",
    Heure: v.created_at ? new Date(v.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
    Délégué: `${v.user?.first_name || ""} ${v.user?.last_name || ""}`.trim(),
    Médecin: `${v.doctor?.first_name || ""} ${v.doctor?.last_name || ""}`.trim(),
    Wilaya: v.doctor?.wilaya || "",
    Produit: v.product?.name || "",
    Notes: v.notes || "",
  }));
  const wsVisites = XLSX.utils.json_to_sheet(visitsData);
  XLSX.utils.book_append_sheet(wb, wsVisites, "Visites");

  // Sheet 3: Délégués
  const usersData = (usersRes.data || []).map((u) => ({
    Nom: u.last_name || "",
    Prénom: u.first_name || "",
    Email: u.email,
    Rôle: u.role === "superviseur" ? "Superviseur" : "Délégué",
    "Créé le": u.created_at ? new Date(u.created_at).toLocaleDateString("fr-FR") : "",
  }));
  const wsUsers = XLSX.utils.json_to_sheet(usersData);
  XLSX.utils.book_append_sheet(wb, wsUsers, "Délégués");

  // Sheet 4: Territoires
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const territoriesData = (territoriesRes.data || []).map((t: any) => ({
    Wilaya: t.wilaya,
    Délégué: `${t.user?.first_name || ""} ${t.user?.last_name || ""}`.trim(),
  }));
  const wsTerritoires = XLSX.utils.json_to_sheet(territoriesData);
  XLSX.utils.book_append_sheet(wb, wsTerritoires, "Territoires");

  // Generate buffer
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const date = new Date().toISOString().split("T")[0];
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="handson-export-${date}.xlsx"`,
    },
  });
}
