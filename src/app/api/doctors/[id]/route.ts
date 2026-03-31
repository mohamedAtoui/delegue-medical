import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";

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
  const { first_name, last_name, doctor_type, specialty, address, latitude, longitude, wilaya, phone, potentiel, engagement } = body;

  if (!first_name || !last_name || !wilaya) {
    return NextResponse.json(
      { error: "Prénom, nom et wilaya sont requis" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("doctors")
    .update({
      first_name,
      last_name,
      doctor_type: doctor_type || "medecin",
      specialty: specialty || null,
      address: address || null,
      latitude: latitude || null,
      longitude: longitude || null,
      wilaya,
      phone: phone || null,
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

  return NextResponse.json(data);
}
