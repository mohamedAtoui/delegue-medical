import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("include_inactive") === "true";

  let query = supabase.from("products").select("*").order("name");
  if (!includeInactive) query = query.eq("active", true);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name,
      description: body.description?.trim() || null,
      reference: body.reference?.trim() || null,
      laboratory: body.laboratory?.trim() || null,
      quantity:
        body.quantity === undefined || body.quantity === null || body.quantity === ""
          ? null
          : Number(body.quantity),
      price:
        body.price === undefined || body.price === null || body.price === ""
          ? null
          : Number(body.price),
      notes: body.notes?.trim() || null,
      active: body.active === undefined ? true : !!body.active,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
