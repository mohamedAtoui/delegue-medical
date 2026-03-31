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
  const search = searchParams.get("search");
  const wilaya = searchParams.get("wilaya");
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

  if (wilaya) {
    query = query.eq("wilaya", wilaya);
  }

  const { data, error, count } = await query
    .order("last_name")
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
  const { first_name, last_name, specialty, wilaya, phone } = body;

  if (!first_name || !last_name || !wilaya) {
    return NextResponse.json(
      { error: "Prenom, nom et wilaya sont requis" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const currentUser = await getOrCreateUser();

  const { data, error } = await supabase
    .from("doctors")
    .insert({
      first_name,
      last_name,
      specialty: specialty || null,
      wilaya,
      phone: phone || null,
      created_by: currentUser?.id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
