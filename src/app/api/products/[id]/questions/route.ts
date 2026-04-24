import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

const INPUT_TYPES = new Set([
  "yes_no",
  "short_text",
  "textarea",
  "number",
]);
const TARGET_ROLES = new Set(["medecin", "pharmacien"]);

function normaliseVisibleWhen(raw: unknown): unknown | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object") return null;
  const rule = raw as Record<string, unknown>;
  if (rule.op === "eq" && typeof rule.question_id === "string") {
    return { op: "eq", question_id: rule.question_id, value: rule.value };
  }
  // Unknown ops: pass through so future rule shapes survive; the client
  // fails open on unknown ops.
  return rule;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const targetRole = searchParams.get("target_role");

  const supabase = await createClient();
  let query = supabase
    .from("product_questions")
    .select("*")
    .eq("product_id", id)
    .is("deleted_at", null)
    .order("display_order", { ascending: true });

  if (targetRole && TARGET_ROLES.has(targetRole)) {
    query = query.eq("target_role", targetRole);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

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

  const label = (body.label || "").trim();
  if (!label) {
    return NextResponse.json({ error: "Le libellé est requis" }, { status: 400 });
  }
  if (!TARGET_ROLES.has(body.target_role)) {
    return NextResponse.json(
      { error: "target_role invalide" },
      { status: 400 }
    );
  }
  if (!INPUT_TYPES.has(body.input_type)) {
    return NextResponse.json(
      { error: "input_type invalide" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Place new questions at the end of their tab by default.
  let displayOrder = 0;
  if (typeof body.display_order === "number") {
    displayOrder = body.display_order;
  } else {
    const { data: last } = await supabase
      .from("product_questions")
      .select("display_order")
      .eq("product_id", productId)
      .eq("target_role", body.target_role)
      .is("deleted_at", null)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    displayOrder = last ? last.display_order + 1 : 0;
  }

  const { data, error } = await supabase
    .from("product_questions")
    .insert({
      product_id: productId,
      target_role: body.target_role,
      label,
      input_type: body.input_type,
      required: !!body.required,
      display_order: displayOrder,
      visible_when: normaliseVisibleWhen(body.visible_when),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
