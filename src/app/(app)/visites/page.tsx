import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { redirect } from "next/navigation";
import { VisitesClient } from "./visites-client";
import { fetchVisits } from "@/lib/queries/visits";

export default async function VisitesPage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");

  const isSupervisor = user.role === "superviseur";

  // Hoist the initial fetch to the server so the page renders with data
  // already in the HTML — avoids the "0 visits → real data" flash.
  const initial = await fetchVisits({
    all: isSupervisor,
    currentUserId: user.id,
    page: 1,
    limit: 50,
  });

  return (
    <VisitesClient
      role={user.role}
      initialVisits={initial.data}
      initialTotal={initial.count}
    />
  );
}
