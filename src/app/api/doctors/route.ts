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
  const search = searchParams.get("search");
  const wilaya = searchParams.get("wilaya");
  const specialty = searchParams.get("specialty");
  const type = searchParams.get("type");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  const supabase = await createClient();
  let query = supabase.from("doctors").select("*", { count: "exact" });

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%`
    );
  }
  if (wilaya) query = query.eq("wilaya", wilaya);
  if (specialty) query = query.eq("specialty", specialty);
  if (type === "medecin" || type === "pharmacien") query = query.eq("doctor_type", type);

  const { data: doctors, error, count } = await query
    .order("last_name")
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get last visit date for each doctor
  if (doctors && doctors.length > 0) {
    const doctorIds = doctors.map((d) => d.id);
    const { data: lastVisits } = await supabase
      .from("visits")
      .select("doctor_id, created_at")
      .in("doctor_id", doctorIds)
      .order("created_at", { ascending: false });

    const lastVisitMap = new Map<string, string>();
    lastVisits?.forEach((v) => {
      if (!lastVisitMap.has(v.doctor_id)) {
        lastVisitMap.set(v.doctor_id, v.created_at);
      }
    });

    doctors.forEach((doc) => {
      (doc as Record<string, unknown>).last_visited_at = lastVisitMap.get(doc.id) || null;
    });
  }

  return NextResponse.json({ data: doctors, count, page, limit });
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
