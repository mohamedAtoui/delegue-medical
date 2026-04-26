import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";

const TARGET_ROLES = new Set(["medecin", "pharmacien"]);

/**
 * List ALL non-deleted product questions across active products,
 * filtered by `target_role`. Used by the visit form when a delegue
 * is logging a pharmacien visit (which spans every product at once).
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetRole = searchParams.get("target_role");
  if (!targetRole || !TARGET_ROLES.has(targetRole)) {
    return NextResponse.json(
      { error: "target_role requis (medecin | pharmacien)" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_questions")
    .select(`*, product:products(id, name, active)`)
    .eq("target_role", targetRole)
    .is("deleted_at", null)
    .order("product_id", { ascending: true })
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Drop questions whose parent product is inactive
  const filtered = (data || []).filter(
    (q: { product?: { active?: boolean } | null }) => q.product?.active !== false
  );

  return NextResponse.json(filtered);
}
