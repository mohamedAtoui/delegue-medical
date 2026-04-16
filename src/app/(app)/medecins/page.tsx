import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { redirect } from "next/navigation";
import { MedecinsClient } from "./medecins-client";

export default async function MedecinsPage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");
  return <MedecinsClient role={user.role} />;
}
