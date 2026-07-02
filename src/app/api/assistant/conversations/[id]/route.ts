import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Load the conversation and verify the caller is a supervisor who owns it. */
async function loadOwned(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
) {
  const { data } = await supabase
    .from("ai_conversations")
    .select("id, user_id, title")
    .eq("id", conversationId)
    .single();
  if (!data || data.user_id !== userId) return null;
  return data;
}

// Load a conversation and its full message history (for re-rendering a chat).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (currentUser.role !== "superviseur") {
    return NextResponse.json({ error: "Réservé au superviseur" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const conv = await loadOwned(supabase, id, currentUser.id);
  if (!conv) {
    return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
  }

  const { data: messages, error } = await supabase
    .from("ai_messages")
    .select("id, role, content, parts, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ conversation: conv, messages: messages ?? [] });
}

// Rename a conversation.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (currentUser.role !== "superviseur") {
    return NextResponse.json({ error: "Réservé au superviseur" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!title) {
    return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  }

  const supabase = await createClient();
  const conv = await loadOwned(supabase, id, currentUser.id);
  if (!conv) {
    return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
  }

  const { error } = await supabase
    .from("ai_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, title });
}

// Delete a conversation (messages cascade).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (currentUser.role !== "superviseur") {
    return NextResponse.json({ error: "Réservé au superviseur" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const conv = await loadOwned(supabase, id, currentUser.id);
  if (!conv) {
    return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
  }

  const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
