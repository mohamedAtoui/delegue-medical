import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { redirect } from "next/navigation";

export default async function DeleguesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOrCreateUser();
  if (!user || user.role !== "superviseur") {
    redirect("/visites");
  }
  return <>{children}</>;
}
