import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { createClient } from "@/utils/supabase/server";
import { AssistantClient } from "@/components/assistant/assistant-client";

export default async function AssistantPage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "superviseur") redirect("/visites");

  // Load the conversation list for the sidebar; messages are fetched per
  // conversation on the client.
  const supabase = await createClient();
  const { data: conversations } = await supabase
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return <AssistantClient initialConversations={conversations ?? []} />;
}
