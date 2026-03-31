import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { summarizeVisitNotes } from "@/lib/mistral";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await request.json();
  const { wilaya, user_id, from, to } = body;

  const supabase = await createClient();

  // Build query for visit notes
  let query = supabase
    .from("visits")
    .select("notes, doctor:doctors(wilaya)")
    .not("notes", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (user_id) query = query.eq("user_id", user_id);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data: visits, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by wilaya if specified (post-query since it's a join)
  let filteredVisits = visits || [];
  if (wilaya) {
    filteredVisits = filteredVisits.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (v: any) => v.doctor?.wilaya === wilaya
    );
  }

  const notes = filteredVisits
    .map((v) => v.notes)
    .filter((n): n is string => !!n);

  if (notes.length === 0) {
    return NextResponse.json({
      summary: "Aucune note de visite trouvee pour les criteres selectionnes.",
    });
  }

  try {
    const summary = await summarizeVisitNotes(notes);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur IA" },
      { status: 500 }
    );
  }
}
