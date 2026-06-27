"use client";

import { useEffect, useRef, useState } from "react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Charts } from "@/components/dashboard/charts";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Button } from "@/components/ui/button";
import { MedicalLoader } from "@/components/ui/medical-loader";
import {
  DateRangeFilter,
  resolveDateRange,
  TODAY,
  type DateRangeValue,
} from "@/components/shared/date-range-filter";
import { Download } from "lucide-react";
import type { DashboardStats } from "@/lib/queries/stats";
import type { VisitWithDetails } from "@/types";

interface DashboardClientProps {
  initialStats: DashboardStats;
  initialVisits: VisitWithDetails[];
}

export function DashboardClient({
  initialStats,
  initialVisits,
}: DashboardClientProps) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  // Default matches the server-rendered initial fetch (today).
  const [dateRange, setDateRange] = useState<DateRangeValue>(TODAY);
  const [refetching, setRefetching] = useState(false);
  const skipNext = useRef(true);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const { from, to } = resolveDateRange(dateRange);
    if (!from || !to) return; // custom range with empty inputs — wait
    const ctrl = new AbortController();

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: show loader before fetch starts
    setRefetching(true);
    const params = new URLSearchParams({ from, to });
    fetch(`/api/stats?${params}`, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => {
        if (err?.name !== "AbortError") throw err;
      })
      .finally(() => setRefetching(false));

    return () => ctrl.abort();
  }, [dateRange]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            Vue d&apos;ensemble de l&apos;activité
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            required
            className="min-w-[220px]"
          />
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              window.open("/api/export", "_blank");
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Exporter Excel
          </Button>
        </div>
      </div>

      <div className="relative">
        {refetching && <MedicalLoader variant="overlay" />}

        {/* KPIs */}
        <StatsCards
          totalVisits={stats.totalVisits}
          activeReps={stats.activeReps}
          doctorsVisited={stats.doctorsVisited}
        />

        {/* Charts */}
        <div className="mt-6">
          <Charts byRep={stats.byRep} byWilaya={stats.byWilaya} />
        </div>
      </div>

      {/* Recent activity. The AI assistant now lives on its own page (/assistant). */}
      <ActivityFeed initialVisits={initialVisits} />
    </div>
  );
}
