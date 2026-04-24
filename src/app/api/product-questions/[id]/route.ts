import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

const INPUT_TYPES = new Set([
  "yes_no",
  "short_text",
  "textarea",
  "number",
]);

function normaliseVisibleWhen(raw: unknown): unknown | null {
  if (raw === null) return null;
  if (raw === undefined) return undefined;
  if (typeof raw !== "object") return null;
  const rule = raw as Record<string, unknown>;
  if (rule.op === "eq" && typeof rule.question_id === "string") {
    return { op: "eq", question_id: rule.question_id, value: rule.value };
  }
  return rule;
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
      { error: "Réservé au superviseur" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  const update: Record<string, unknown> = {};

  if (typeof body.label === "string") {
    const label = body.label.trim();
    if (!label) {
      return NextResponse.json(
        { error: "Le libellé ne peut pas être vide" },
        { status: 400 }
      );
    }
    update.label = label;
  }

  if (body.input_type !== undefined) {
    if (!INPUT_TYPES.has(body.input_type)) {
      return NextResponse.json(
        { error: "input_type invalide" },
        { status: 400 }
      );
    }
    update.input_type = body.input_type;
  }

  if (typeof body.required === "boolean") update.required = body.required;
  if (typeof body.display_order === "number") update.display_order = body.display_order;

  const visibleWhen = normaliseVisibleWhen(body.visible_when);
  if (visibleWhen !== undefined) update.visible_when = visibleWhen;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
  }

  const supabase = await createClient();

  // Changing input_type on an answered question would orphan data in the
  // wrong value_* column — block it to keep answer rows consistent.
  if (update.input_type !== undefined) {
    const { count, error: countError } = await supabase
      .from("visit_answers")
      .select("id", { count: "exact", head: true })
      .eq("question_id", id);
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "Cette question possède déjà des réponses : le type ne peut plus être modifié. Supprimez-la et créez-en une nouvelle.",
        },
        { status: 409 }
      );
    }
  }

  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("product_questions")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
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

  const { id } = await params;
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  // Soft delete — existing visit_answers keep their FK target, and the
  // question can still be joined for read-side rendering.
  const { error } = await supabase
    .from("product_questions")
    .update({ deleted_at: nowIso, updated_at: nowIso })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
