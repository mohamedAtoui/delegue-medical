import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { getAssignedWilayas } from "@/lib/queries/territories";
import { cleanGrossisteLinks } from "@/lib/grossistes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Territory scoping: a délégué may only open médecins/pharmaciens in their
  // assigned wilayas. Grossistes are national and stay accessible.
  const currentUser = await getOrCreateUser();
  if (
    currentUser?.role === "delegue" &&
    data?.doctor_type !== "grossiste"
  ) {
    const allowed = await getAssignedWilayas(currentUser.id);
    if (!allowed.includes(data?.wilaya)) {
      return NextResponse.json({ error: "Accès restreint à votre région" }, { status: 403 });
    }
  }

  // Attach the pharmacy's grossiste links (best-effort, non-fatal).
  if (data?.doctor_type === "pharmacien") {
    const { data: links } = await supabase
      .from("doctor_grossistes")
      .select(
        "grossiste_id, category, grossiste:doctors!doctor_grossistes_grossiste_id_fkey(id, last_name, wilaya)"
      )
      .eq("doctor_id", id);
    (data as Record<string, unknown>).doctor_grossistes = links || [];
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
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
    grossistes,
  } = body;

  if (!first_name || !last_name || !wilaya) {
    return NextResponse.json(
      { error: "Prénom, nom et wilaya sont requis" },
      { status: 400 }
    );
  }

  const isPharmacien = doctor_type === "pharmacien";
  const isGrossiste = doctor_type === "grossiste";
  if (!isPharmacien && !isGrossiste && !specialty) {
    return NextResponse.json({ error: "La spécialité est requise pour un médecin" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("doctors")
    .update({
      first_name,
      last_name,
      doctor_type: doctor_type || "medecin",
      specialty: isPharmacien || isGrossiste ? null : (specialty || null),
      address: address || null,
      google_maps_url: google_maps_url || null,
      wilaya,
      commune: commune?.trim() || null,
      phone: phone_mobile || phone_fixe || null,
      phone_fixe: phone_fixe || null,
      phone_mobile: phone_mobile || null,
      email: email || null,
      grossiste_pharma: isPharmacien ? (grossiste_pharma || null) : null,
      grossiste_para_pharm: isPharmacien ? (grossiste_para_pharm || null) : null,
      potentiel: potentiel || null,
      engagement: engagement || 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync pharmacy → grossiste links when the client sent a grossistes array.
  // A missing array means "don't touch links"; an empty array clears them.
  if (isPharmacien && grossistes !== undefined) {
    const links = cleanGrossisteLinks(grossistes);
    await supabase.from("doctor_grossistes").delete().eq("doctor_id", id);
    if (links.length > 0) {
      await supabase.from("doctor_grossistes").insert(
        links.map((g) => ({
          doctor_id: id,
          grossiste_id: g.grossiste_id,
          category: g.category,
        }))
      );
    }
  }

  return NextResponse.json(data);
}

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
      { error: "Seul un superviseur peut supprimer un médecin ou pharmacien" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from("doctors").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
