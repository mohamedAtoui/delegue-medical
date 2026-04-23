import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

export async function GET() {
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

  const supabase = await createClient();

  const { data: invites, error } = await supabase
    .from("invited_users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark which invites already signed up
  const emails = (invites || []).map((i) => i.email.toLowerCase());
  const { data: signedUpUsers } = emails.length
    ? await supabase.from("users").select("email").in("email", emails)
    : { data: [] as { email: string }[] };

  const signedUpSet = new Set(
    (signedUpUsers || []).map((u) => u.email.toLowerCase())
  );

  const enriched = (invites || []).map((i) => ({
    ...i,
    signed_up: signedUpSet.has(i.email.toLowerCase()),
  }));

  return NextResponse.json(enriched);
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
  const email = (body.email || "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }

  const supabase = await createClient();

  // Check duplicate
  const { data: existing } = await supabase
    .from("invited_users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Cet email est déjà invité" },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("invited_users")
    .insert({
      email,
      invited_by: currentUser.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
