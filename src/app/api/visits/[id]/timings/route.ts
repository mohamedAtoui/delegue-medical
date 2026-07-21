import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

/**
 * Visit stage timings + their correction audit trail.
 *
 * GET  — anyone signed in: the visit's timings and the full audit history.
 * PATCH — superviseur only: correct one stage's duration (and optionally its
 *   start/end). Every correction writes a visit_timing_audits row (who, when,
 *   old → new) so the change is fully traceable. Délégués have no way to
 *   modify a recorded timing.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: timings }, { data: audits }] = await Promise.all([
    supabase
      .from("visit_timings")
      .select("*")
      .eq("visit_id", id)
      .order("stage"),
    supabase
      .from("visit_timing_audits")
      .select(
        "*, editor:users!visit_timing_audits_edited_by_fkey(id, first_name, last_name)"
      )
      .eq("visit_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({ timings: timings || [], audits: audits || [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (currentUser.role !== "superviseur") {
    return NextResponse.json(
      { error: "Seul un superviseur peut corriger les durées" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  const { stage, duration_seconds, started_at, ended_at, reason } = body as {
    stage?: string;
    duration_seconds?: number;
    started_at?: string | null;
    ended_at?: string | null;
    reason?: string | null;
  };

  if (stage !== "trajet" && stage !== "attente" && stage !== "visite") {
    return NextResponse.json({ error: "Étape invalide" }, { status: 400 });
  }
  if (
    typeof duration_seconds !== "number" ||
    !Number.isFinite(duration_seconds) ||
    duration_seconds < 0
  ) {
    return NextResponse.json(
      { error: "Durée invalide" },
      { status: 400 }
    );
  }
  const newDuration = Math.round(duration_seconds);

  const supabase = await createClient();

  // Existing timing for this (visit, stage), if any.
  const { data: existing } = await supabase
    .from("visit_timings")
    .select("*")
    .eq("visit_id", id)
    .eq("stage", stage)
    .maybeSingle();

  const newStarted = started_at !== undefined ? started_at : existing?.started_at ?? null;
  const newEnded = ended_at !== undefined ? ended_at : existing?.ended_at ?? null;

  let timingId = existing?.id as string | undefined;

  if (existing) {
    const { error } = await supabase
      .from("visit_timings")
      .update({
        duration_seconds: newDuration,
        started_at: newStarted,
        ended_at: newEnded,
      })
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    // No timing yet for this stage — create it (admin-entered → manual).
    const { data: created, error } = await supabase
      .from("visit_timings")
      .insert({
        visit_id: id,
        stage,
        started_at: newStarted,
        ended_at: newEnded,
        duration_seconds: newDuration,
        mode: "manual",
      })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    timingId = created.id;
  }

  // Audit the change.
  await supabase.from("visit_timing_audits").insert({
    visit_timing_id: timingId ?? null,
    visit_id: id,
    stage,
    edited_by: currentUser.id,
    old_duration_seconds: existing?.duration_seconds ?? null,
    new_duration_seconds: newDuration,
    old_started_at: existing?.started_at ?? null,
    new_started_at: newStarted,
    old_ended_at: existing?.ended_at ?? null,
    new_ended_at: newEnded,
    reason: reason?.trim() || null,
  });

  return NextResponse.json({ success: true });
}
