import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import type { User } from "@/types";

const SUPERVISOR_EMAILS = [
  "attaimen40@gmail.com",
  "sarl.handson@gmail.com",
];

export async function getOrCreateUser(): Promise<User | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = await createClient();

  // Try to find existing user
  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_id", userId)
    .single();

  if (existingUser) {
    // Keep avatar_url in sync with Clerk profile photo
    const clerkUser = await currentUser();
    if (clerkUser && clerkUser.imageUrl && existingUser.avatar_url !== clerkUser.imageUrl) {
      const { data: updated } = await supabase
        .from("users")
        .update({ avatar_url: clerkUser.imageUrl, updated_at: new Date().toISOString() })
        .eq("id", existingUser.id)
        .select()
        .single();
      return updated ?? existingUser;
    }
    return existingUser;
  }

  // User not in Supabase yet — create from Clerk data
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const isSupervisor = SUPERVISOR_EMAILS.includes(email);

  // Allowlist check: only invited emails (or supervisors) can create an account
  if (!isSupervisor && email) {
    const { data: invite } = await supabase
      .from("invited_users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (!invite) {
      console.warn(`Sign-up blocked: ${email} not in invited_users allowlist`);
      return null;
    }
  }

  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      clerk_id: userId,
      email,
      first_name: clerkUser.firstName,
      last_name: clerkUser.lastName,
      avatar_url: clerkUser.imageUrl ?? null,
      role: isSupervisor ? "superviseur" : "delegue",
    })
    .select()
    .single();

  if (error) {
    console.error("Error syncing user to Supabase:", error);
    return null;
  }

  return newUser;
}
