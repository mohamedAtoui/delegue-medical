import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { fetchDoctors } from "@/lib/queries/doctors";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  try {
    const result = await fetchDoctors({
      search: searchParams.get("search"),
      wilaya: searchParams.get("wilaya"),
      specialty: searchParams.get("specialty"),
      type: type === "medecin" || type === "pharmacien" ? type : null,
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
    first_name,
    last_name,
    doctor_type,
    specialty,
    address,
    google_maps_url,
    wilaya,
    commune,
    phone_fixe,
    phone_mobile,
    email,
    grossiste_pharma,
    grossiste_para_pharm,
    potentiel,
    engagement,
  } = body;

  if (!first_name || !last_name || !wilaya) {
    return NextResponse.json(
      { error: "Prénom, nom et wilaya sont requis" },
      { status: 400 }
    );
  }

  const isPharmacien = doctor_type === "pharmacien";
  if (!isPharmacien && !specialty) {
    return NextResponse.json({ error: "La spécialité est requise pour un médecin" }, { status: 400 });
  }
  if (!address) {
    return NextResponse.json({ error: "L'adresse est requise" }, { status: 400 });
  }
  if (!phone_fixe) {
    return NextResponse.json({ error: "Le téléphone fixe est requis" }, { status: 400 });
  }

  const supabase = await createClient();
  const currentUser = await getOrCreateUser();

  const { data, error } = await supabase
    .from("doctors")
    .insert({
      first_name,
      last_name,
      doctor_type: doctor_type || "medecin",
      specialty: isPharmacien ? null : (specialty || null),
      address: address || null,
      google_maps_url: google_maps_url || null,
      wilaya,
      commune: commune?.trim() || null,
      phone: phone_mobile || phone_fixe || null, // backward compat
      phone_fixe: phone_fixe || null,
      phone_mobile: phone_mobile || null,
      email: email || null,
      grossiste_pharma: isPharmacien ? (grossiste_pharma || null) : null,
      grossiste_para_pharm: isPharmacien ? (grossiste_para_pharm || null) : null,
      potentiel: potentiel || null,
      engagement: engagement || 0,
      created_by: currentUser?.id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
