import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { createClient } from "@/utils/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import type { UserRole } from "@/types";
import { headers } from "next/headers";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getOrCreateUser();

  // If Clerk session is valid but the user is not in our DB (not allowlisted),
  // redirect to the non-autorise page instead of treating as a delegue.
  if (!user) {
    redirect("/non-autorise");
  }

  const role: UserRole = user.role || "delegue";

  // Check if delegate needs onboarding (no phone or no territories)
  if (user && role === "delegue" && !user.phone) {
    const headersList = await headers();
    const pathname = headersList.get("x-next-pathname") || "";
    // Don't redirect if already on onboarding
    if (!pathname.includes("onboarding")) {
      const supabase = await createClient();
      const { data: territories } = await supabase
        .from("territory_assignments")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (!territories || territories.length === 0) {
        redirect("/onboarding");
      }
    }
  }

  return <AppShell role={role}>{children}</AppShell>;
}
