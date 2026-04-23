import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (currentUser.role !== "superviseur") {
    return NextResponse.json(
      { error: "Réservé au superviseur" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  const update: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const n = body.name.trim();
    if (!n) {
      return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    }
    update.name = n;
  }
  if (body.description !== undefined) update.description = body.description?.trim() || null;
  if (body.reference !== undefined) update.reference = body.reference?.trim() || null;
  if (body.laboratory !== undefined) update.laboratory = body.laboratory?.trim() || null;
  if (body.quantity !== undefined) {
    update.quantity =
      body.quantity === null || body.quantity === "" ? null : Number(body.quantity);
  }
  if (body.price !== undefined) {
    update.price =
      body.price === null || body.price === "" ? null : Number(body.price);
  }
  if (body.notes !== undefined) update.notes = body.notes?.trim() || null;
  if (typeof body.active === "boolean") update.active = body.active;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
      { error: "Réservé au superviseur" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
