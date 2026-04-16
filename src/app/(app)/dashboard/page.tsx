import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { redirect } from "next/navigation";
import {
  fetchDashboardStats,
  getDateRangeForPeriod,
} from "@/lib/queries/stats";
import { fetchVisits } from "@/lib/queries/visits";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "superviseur") redirect("/visites");

  // Hoist both fetches to the server in parallel so the dashboard renders
  // with real numbers and recent activity already on screen — no flash of 0s.
  const [initialStats, recentVisits] = await Promise.all([
    fetchDashboardStats(getDateRangeForPeriod("today")),
    fetchVisits({ all: true, page: 1, limit: 20 }),
  ]);

  return (
    <DashboardClient
      initialStats={initialStats}
      initialVisits={recentVisits.data}
    />
  );
}
