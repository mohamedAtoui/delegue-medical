import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { AppShell } from "@/components/layout/app-shell";
import type { UserRole } from "@/types";

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
  const role: UserRole = user?.role || "delegue";

  return <AppShell role={role}>{children}</AppShell>;
}
