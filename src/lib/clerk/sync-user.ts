import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import type { User } from "@/types";

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

  if (existingUser) return existingUser;

  // User not in Supabase yet — create from Clerk data
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      clerk_id: userId,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      first_name: clerkUser.firstName,
      last_name: clerkUser.lastName,
      role: "delegue",
    })
    .select()
    .single();

  if (error) {
    console.error("Error syncing user to Supabase:", error);
    return null;
  }

  return newUser;
}
