import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { askAboutVisits } from "@/lib/mistral";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const { wilaya, user_id, from, to, prompt } = body;

  const supabase = await createClient();

  let query = supabase
    .from("visits")
    .select("notes, doctor:doctors(first_name, last_name, wilaya, specialty), user:users(first_name, last_name)")
    .not("notes", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (user_id && user_id !== "all") query = query.eq("user_id", user_id);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data: visits, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filteredVisits = (visits || []) as any[];
  if (wilaya) {
    filteredVisits = filteredVisits.filter((v) => v.doctor?.wilaya === wilaya);
  }

  if (filteredVisits.length === 0) {
    return NextResponse.json({
      summary: "Aucune note de visite trouvée pour les critères sélectionnés.",
    });
  }

  // Build rich context for AI
  const context = filteredVisits.map((v, i) => {
    const doc = `Dr. ${v.doctor?.first_name || ""} ${v.doctor?.last_name || ""}`.trim();
    const rep = `${v.user?.first_name || ""} ${v.user?.last_name || ""}`.trim();
    const spec = v.doctor?.specialty || "";
    const wil = v.doctor?.wilaya || "";
    return `${i + 1}. [Délégué: ${rep}] [Médecin: ${doc}, ${spec}, ${wil}] Note: ${v.notes}`;
  }).join("\n");

  try {
    const summary = await askAboutVisits(context, prompt || "Résumer les points clés");
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur IA" },
      { status: 500 }
    );
  }
}
