import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { redirect } from "next/navigation";
import { fetchDoctors } from "@/lib/queries/doctors";
import { getAssignedWilayas } from "@/lib/queries/territories";
import { MedecinsClient } from "./medecins-client";

export default async function MedecinsPage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");

  // Délégués only see médecins/pharmaciens in their assigned wilayas.
  const restrictWilayas =
    user.role === "delegue" ? await getAssignedWilayas(user.id) : null;

  // Hoist initial fetch to the server — page renders with doctors already
  // present, no "Aucun résultat" flash.
  const initial = await fetchDoctors({ page: 1, limit: 500, restrictWilayas });

  return (
    <MedecinsClient
      role={user.role}
      initialDoctors={initial.data}
      allowedWilayas={restrictWilayas}
    />
  );
}
