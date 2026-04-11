import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { redirect } from "next/navigation";
import { VisitesClient } from "./visites-client";

export default async function VisitesPage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");
  return <VisitesClient role={user.role} />;
}
