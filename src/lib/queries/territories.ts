import { createClient } from "@/utils/supabase/server";

/**
 * Wilayas assigned to a user (their territory). Returns an empty array if the
 * user has none. Délégués are gated through onboarding until they have at least
 * one, so in practice a délégué always has ≥1.
 */
export async function getAssignedWilayas(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("territory_assignments")
    .select("wilaya")
    .eq("user_id", userId);
  return (data ?? []).map((t) => t.wilaya as string);
}
