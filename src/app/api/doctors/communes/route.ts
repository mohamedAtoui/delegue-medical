import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Distinct communes that actually have contacts in the directory, optionally
 * scoped to a wilaya. Powers the commune filter so it only ever offers
 * communes that can return results.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const wilaya = searchParams.get("wilaya");

  const supabase = await createClient();
  let query = supabase
    .from("doctors")
    .select("commune")
    .not("commune", "is", null)
    .limit(10000);

  if (wilaya) query = query.eq("wilaya", wilaya);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const communes = Array.from(
    new Set(
      (data || [])
        .map((d) => (d.commune || "").trim())
        .filter((c) => c.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, "fr"));

  return NextResponse.json({ data: communes });
}
