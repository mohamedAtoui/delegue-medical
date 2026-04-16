import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { redirect } from "next/navigation";
import { fetchDoctors } from "@/lib/queries/doctors";
import { MedecinsClient } from "./medecins-client";

export default async function MedecinsPage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");

  // Hoist initial fetch to the server — page renders with doctors already
  // present, no "Aucun résultat" flash.
  const initial = await fetchDoctors({ page: 1, limit: 20 });

  return <MedecinsClient role={user.role} initialDoctors={initial.data} />;
}
