import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import type { User, UserRole } from "@/types";

export async function getCurrentUser(): Promise<User | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_id", userId)
    .single();

  return data;
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  return user;
}

export async function requireRole(role: UserRole): Promise<User> {
  const user = await requireAuth();
  if (user.role !== role) {
    redirect("/");
  }
  return user;
}

export function isSuperviser(user: User): boolean {
  return user.role === "superviseur";
}
