import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userFilter = searchParams.get("user_id");
  const doctorId = searchParams.get("doctor_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const all = searchParams.get("all") === "true";
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  let query = supabase
    .from("visits")
    .select(
      "*, doctor:doctors(*), product:products(*), user:users(*)",
      { count: "exact" }
    );

  if (!all) {
    // By default, show only the current user's visits
    const currentUser = await getOrCreateUser();
    if (currentUser) {
      query = query.eq("user_id", userFilter || currentUser.id);
    }
  }

  if (doctorId) query = query.eq("doctor_id", doctorId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, count, page, limit });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await request.json();
  const { doctor_id, product_id, notes } = body;

  if (!doctor_id || !product_id) {
    return NextResponse.json(
      { error: "Medecin et produit sont requis" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Utilisateur non trouve" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("visits")
    .insert({
      user_id: currentUser.id,
      doctor_id,
      product_id,
      notes: notes || null,
    })
    .select("*, doctor:doctors(*), product:products(*), user:users(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
