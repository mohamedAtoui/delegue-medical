import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

export async function POST(
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

  const { id: productId } = await params;
  const body = await request.json();
  const orderedIds: unknown = body.ordered_ids;

  if (!Array.isArray(orderedIds) || orderedIds.some((x) => typeof x !== "string")) {
    return NextResponse.json(
      { error: "ordered_ids doit être un tableau d'identifiants" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  // Single-table updates only — one UPDATE per row. For a typical question
  // list (< 20 rows) this is fine and keeps the code transaction-free.
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i] as string;
    const { error } = await supabase
      .from("product_questions")
      .update({ display_order: i, updated_at: nowIso })
      .eq("id", id)
      .eq("product_id", productId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
