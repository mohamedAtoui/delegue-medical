import { Suspense } from "react";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { redirect } from "next/navigation";
import { PlanificationClient } from "./planification-client";
import { fetchAssignments } from "@/lib/queries/assignments";

export default async function PlanificationPage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");

  // Fetch assignments server-side so the page renders with planning data
  // already on screen.
  const initial = await fetchAssignments({
    currentUserId: user.id,
    currentUserRole: user.role,
    page: 1,
    limit: 100,
  });

  return (
    <Suspense fallback={null}>
      <PlanificationClient
        userId={user.id}
        initialAssignments={initial.data}
      />
    </Suspense>
  );
}
