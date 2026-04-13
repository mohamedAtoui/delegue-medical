import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { redirect } from "next/navigation";
import { PlanificationClient } from "./planification-client";

export default async function PlanificationPage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");
  return <PlanificationClient userId={user.id} />;
}
