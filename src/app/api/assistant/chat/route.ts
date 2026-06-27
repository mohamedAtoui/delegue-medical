import { NextRequest, NextResponse } from "next/server";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { getModel, getSystemPrompt, tools } from "@/lib/insights/agent";

// Streaming responses can run longer than the default serverless budget.
export const maxDuration = 60;

/** Concatenate the text parts of a UI message into a plain string. */
function textOf(message: UIMessage): string {
  return (message.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
    .trim();
}

export async function POST(request: NextRequest) {
  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (currentUser.role !== "superviseur") {
    return NextResponse.json({ error: "Réservé au superviseur" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const messages = (body.messages ?? []) as UIMessage[];
  const conversationId = body.conversationId as string | undefined;
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId requis" }, { status: 400 });
  }

  const supabase = await createClient();

  // Verify the conversation exists and belongs to this supervisor.
  const { data: conv } = await supabase
    .from("ai_conversations")
    .select("id, user_id, title")
    .eq("id", conversationId)
    .single();
  if (!conv || conv.user_id !== currentUser.id) {
    return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
  }

  // Persist the new user message (the last one in the list) up front.
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: textOf(lastUser),
      parts: lastUser.parts,
    });
    // Auto-title a brand-new conversation from its first question.
    if (conv.title === "Nouvelle conversation") {
      const title = textOf(lastUser).slice(0, 60) || "Nouvelle conversation";
      await supabase.from("ai_conversations").update({ title }).eq("id", conversationId);
    }
  }

  const result = streamText({
    model: getModel(),
    system: getSystemPrompt(),
    messages: await convertToModelMessages(messages),
    tools,
    // Let the model loop: query, read rows, refine, maybe chart, then answer.
    stopWhen: stepCountIs(6),
  });

  return result.toUIMessageStreamResponse({
    onFinish: async ({ responseMessage }) => {
      await supabase.from("ai_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: textOf(responseMessage),
        parts: responseMessage.parts,
      });
      await supabase
        .from("ai_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    },
  });
}
