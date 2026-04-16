import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { fetchDashboardStats } from "@/lib/queries/stats";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const user = await getOrCreateUser();
  if (!user || user.role !== "superviseur") {
    return NextResponse.json(
      { error: "Accès réservé aux superviseurs" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const from =
    searchParams.get("from") ||
    new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const to = searchParams.get("to") || new Date().toISOString();

  try {
    const stats = await fetchDashboardStats({ from, to });
    return NextResponse.json(stats);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
